import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketService } from './socket.service';
import { RoomsService } from './rooms.service';
import { Room } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
@Injectable()
export class RoomsGateway {
  @WebSocketServer() server: Server;
  constructor(
    private readonly roomService: RoomsService,
    private readonly socketService: SocketService,
    private readonly jwt: JwtService,
  ) {}

  @SubscribeMessage('connected')
  connected(@MessageBody() text: string) {
    console.log(text);
  }

  @SubscribeMessage('connect-room')
  connectToRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    socket.join(roomId);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody()
    { room, sessionToken }: { room: string; sessionToken: string },
    @ConnectedSocket() socket: Socket,
  ) {
    let roomId: string | null;

    try {
      const decodedRoomId = this.jwt.verify(room);
      roomId = decodedRoomId.roomId;
    } catch {
      this.server.to(socket.id).emit('room-joined', { success: false });
      throw new BadRequestException('The Join Token is Invalid');
    }

    socket.join(roomId);
    const decodedUserId = this.jwt.verify(sessionToken);
    const userId = decodedUserId.id;

    let updatedRoom: Room;

    try {
      await this.roomService.joinRoom(roomId, userId);
      updatedRoom = await this.roomService.getRoomById(roomId, userId);
      console.log(updatedRoom);
    } catch (error) {
      this.server.to(socket.id).emit('room-joined', {
        success: false,
      });
      console.log(error);
      return;
    }

    this.server.to(socket.id).emit('room-joined', { success: true, roomId });

    this.server.to(roomId).emit('room-updated', updatedRoom);
  }

  @SubscribeMessage('wish')
  async addWish(
    @MessageBody()
    data: { santaId: string; userId: string; token: string; content: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { santaId, token, content, userId } = data;
    try {
      await this.socketService.createOrUpdateWish(santaId, { content }, token);
      const updatedRoom = await this.roomService.getRoomById(santaId, userId);
      this.server.to(santaId).emit('user-updated', updatedRoom);
      this.server.to(socket.id).emit('user-updated-message');
    } catch (error) {
      this.server.to(socket.id).emit('not-updated', error);
    }
  }

  @SubscribeMessage('address')
  async addAddress(
    @MessageBody()
    data: { santaId: string; userId: string; token: string; content: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { santaId, token, content, userId } = data;
    try {
      await this.socketService.createOrUpdateAddress(
        santaId,
        { content },
        token,
      );
      const updatedRoom = await this.roomService.getRoomById(santaId, userId);
      this.server.to(santaId).emit('user-updated', updatedRoom);
      this.server.to(socket.id).emit('user-updated-message');
    } catch (error) {
      this.server.to(socket.id).emit('not-updated', error);
    }
  }

  @SubscribeMessage('checked-status')
  async checkedStatus(
    @MessageBody() data: { roomId: string; user: string; userId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { roomId, userId, user } = data;

    try {
      await this.socketService.checkStatus(roomId, user, userId);

      const updatedRoom = await this.roomService.getRoomById(roomId, user);

      this.server.to(roomId).emit('user-updated', updatedRoom);
      this.server.to(socket.id).emit('user-updated-message');
    } catch (error) {
      this.server.to(socket.id).emit('not-updated', error);
    }
  }

  @SubscribeMessage('change-limit')
  async changeLimit(
    @MessageBody() data: { roomId: string; userId: string; limit: number },
    @ConnectedSocket() socket: Socket,
  ) {
    const { roomId, userId, limit } = data;

    try {
      await this.socketService.changeLimit(roomId, userId, limit);

      const updatedRoom = await this.roomService.getRoomById(roomId, userId);

      this.server.to(roomId).emit('room-updated', updatedRoom);
      this.server.to(socket.id).emit('user-updated-message');
    } catch (error) {
      console.log(error);
      this.server.to(socket.id).emit('not-updated', error);
    }
  }

  @SubscribeMessage('leave-room')
  async leaveRoom(
    @MessageBody() { roomId, userId }: { roomId: string; userId: string },
  ) {
    const updatedRoom = await this.roomService.getRoomById(roomId, userId);

    this.server.to(roomId).emit('room-updated', updatedRoom);
  }

  @SubscribeMessage('delete-room')
  async deletedRoom(@MessageBody() { roomId }: { roomId: string }) {
    this.server.to(roomId).emit('room-deleted');
  }
}
