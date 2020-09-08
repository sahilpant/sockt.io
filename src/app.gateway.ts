import { SubscribeMessage, WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { v4 as uuid } from 'uuid';
import * as sharedSession from 'express-socket.io-session'
import * as session from 'express-session'

@WebSocketGateway({namespace:'/chat'})
export class AppGateway  implements OnGatewayConnection , OnGatewayDisconnect {
  
	private rooms = []; // room_id : player count
	private users = {}; // client.id : room_id
	private custom_id = {}; // client.id : custome_id by uuid()
	private user_timestamp = {};
	private user_check = {} //client.id : true if user is in a room false if user has left the room
	private room_status = {} //room.id : true if game has been started in that room

	@WebSocketServer() wss: Server


	handleConnection(client: Socket):void {
		client.emit('welcome',`welcome to the server`);
		const pos = this.rooms.findIndex((room) => { return room.players == 1 || room.players == 0});
		if(pos != -1 && (this.room_status[this.rooms[pos].room] != true)){
			this.user_timestamp[client.id] = Date.now();
			this.handleJoin( client, this.rooms[pos].room);
			this.rooms[pos].players++;
			this.user_check[client.id] = `true`;
		}
		else{
			this.user_timestamp[client.id] = Date.now();
			this.handleJoinFirstTime(client);
			console.log(`---------------------------------------`);

			const sessionGame = session({
				secret: "my-secret",
				resave: true,
				saveUninitialized: true
			});
			

			  this.wss.use(sharedSession(sessionGame, {
				  gameid:this.users[client.id],
				  autoSave:true
			  }))
		}
		console.log(this.wss.sockets[client.id].handshake);
	}


	handleJoinFirstTime(client:Socket): void{
		const room_id = uuid();
		this.rooms.push({
			room: `${room_id}`,
			players: 1
		})
		client.join(room_id)
		client.emit('joinedRoom',`welcome to ${room_id}`);
		this.users[client.id] = room_id;
		this.user_check[client.id] = `true`;
		this.custom_id[client.id] = uuid();
	}


	handleJoin(client:Socket , room: string):void{
		client.join(room)
		client.emit('joinedRoom',`welcome to ${room}`);
		this.users[client.id] = room;
		this.custom_id[client.id] = uuid();
	}


	@SubscribeMessage('joinRoom')
	handleExplicitJoin(client:Socket, data:string): void{
		if((Date.now() - (this.user_timestamp[client.id])) >= 15000) { 
			client.emit('Error',`session expired`);
			client.disconnect();
		}
		else{
			const pos = this.rooms.findIndex((room) =>  room.room === data && room.players === 1 || room.players === 0 )
			if( pos != -1 ) {
				client.join(data);
				client.emit('joining',`${data} joined`);
				client.to(this.users[client.id]).broadcast.emit('leaving',`${this.custom_id[client.id]} left the room`);
				client.leave(this.users[client.id]);
				const pos_leave = this.rooms.findIndex((room) => room.room === this.users[client.id]);
				this.rooms[pos_leave].players--;
				this.users[ client.id ] = data;
				this.rooms[ pos ].players++;
				client.to(this.users[client.id]).broadcast.emit('UserJoined' , `user ${this.custom_id[client.id]} joined`);
			}
			else {
				client.emit('Error',`${data} already filled`);
			}
		}
	}


	@SubscribeMessage('leaveRoom')
	handleleave(client:Socket): void {
		client.leave(this.users[client.id]);
		const pos = this.rooms.findIndex((room) => room.room === this.users[client.id]);
		this.rooms[pos].players--;
		this.user_check[client.id] = `false`;
		client.to(this.rooms[pos].room).broadcast.emit('Leave',`${this.custom_id[client.id]} left`);
		delete this.users[client.id];
		delete this.user_timestamp[client.id];
		delete this.custom_id[client.id];
		delete this.user_check[client.id];
	}


	handleDisconnect(client: Socket):void {
		const room = this.users[client.id];
		if(!this.room_status[room]){
			if(this.user_check[client.id]){
				this.handleleave(client);
			}
		}
		else{
			
		}
	}

	@SubscribeMessage('gameOver')
	handleGameOver(client:Socket):void{
		// if(this.user_check[client.id]){
		// 	const pos = this.rooms.findIndex((room) => room.room === this.users[client.id]);
		// 	for(let x in this.wss.sockets){
		// 	if(x.Object.keys(this.rooms[2]) === this.rooms[pos].room){
				
		// 		this.handleleave(x);
		// }
		// 	delete this.rooms[pos];
		// }
		// }
		
		// else{
		// 	client.emit('Error', `connect to a room`)
		// }
		// this.handleleave(client);
		console.log((this.wss.sockets));
		// console.log(((this.wss.sockets[client.id])));
		// for(const x in Object.keys(this.wss.sockets[client.id])){
		// 	console.log(x);
		// }
		// const room = this.users[client.id];
		// this.room_status[room] = false;
	}

	@SubscribeMessage('chat')
	handleChat(client: Socket, data: { message:string , room:string}):void{
		if(!((Date.now() - (this.user_timestamp[client.id])) >= 15000))
		{
			this.wss.to(this.users[client.id]).emit('chat',data);
		}
		else{
			client.emit('Error',`Session Expired`);
			this.handleleave(client);
		}
	}

	@SubscribeMessage('startGame')
	handlegame(client:Socket): void{
		const room = this.users[client.id];
		this.room_status[room] = true;
	}



	@SubscribeMessage('show')
	handleshow(): void {
		console.log(`--------------------------------------------`)
		console.log(`client.id : room.id`);
		console.log(this.users);
		console.log(`room.id : player count`);
		console.log(this.rooms);
		console.log(`client.id : timestamp`);
		console.log(this.user_timestamp);
		console.log(`client.id : check weather they are currently in a room or not`);
		console.log(this.user_check);
		console.log(`client.id : custom id using uuid()`);
		console.log(this.custom_id);
		console.log(` room_id : Game status in the room`);
		console.log(this.room_status);
		console.log(`--------------------------------------------`)
	}
}
