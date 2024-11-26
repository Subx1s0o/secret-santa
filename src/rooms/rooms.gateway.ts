import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from 'socket.io';
import { WishesService } from "src/wishes/wishes.service";
import { RoomsService } from "./rooms.service";


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
    private readonly wishesService: WishesService,
    private readonly jwt: JwtService
  ) {
   
  }

  @SubscribeMessage('connected')
  connected(@MessageBody() text:string) {
    console.log(
      text
    )
  }

@SubscribeMessage('connect-room')
connectToRoom(@MessageBody() roomId: string, @ConnectedSocket() socket: Socket) {
  socket.join(roomId);
  socket.emit("room", roomId)
  console.log('Користувач підключений до кімнати: ' + roomId);
}


  @SubscribeMessage('join-room')
async handleJoinRoom(@MessageBody() {room, sessionToken}:{room:string, sessionToken: string}, @ConnectedSocket() socket: Socket) {
  
  try {
    const decodedRoomId = this.jwt.verify(room)
    const roomId = decodedRoomId.roomId

    console.log(roomId)
    socket.join(roomId)
    const decodedUserId = this.jwt.verify(sessionToken)
    const userId = decodedUserId.id

    try {
      await this.roomService.joinRoom(roomId,userId)
      const updatedRoom = await this.roomService.getRoomById(roomId)
      console.log('Room updated:', updatedRoom)
  
      this.server.to(socket.id).emit('room-joined', { success: true, roomId })
  
     this.server.emit('user-joined', updatedRoom); 
  
    } catch (error) {
 this.server.to(socket.id).emit('room-joined', { success: false, message: 'Failed to join room' })

    }

   
  } catch (error) {
    console.error('Error joining room:', error)

    this.server.to(socket.id).emit('room-joined', { success: false, message: 'Failed to join room' })
  }
}



  // @SubscribeMessage('add-wish')
  // async addWish(@MessageBody() data: { roomId: string, token: string, content: string }) {
  //   const { roomId, token, content } = data;

  //   // Створення або оновлення бажання
  //   await this.wishesService.createOrUpdateWish(roomId, { content }, token);

  //   // Отримуємо актуальну інформацію про кімнату після зміни побажання
  //   const updatedRoom = await this.roomService.getRoomById(roomId);

  //   // Повідомлення всім користувачам цієї кімнати про оновлення бажання
  //   this.server.to(roomId).emit('wish-updated', updatedRoom);
  // }
}
