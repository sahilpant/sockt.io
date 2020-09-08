export enum NotificationType {

    user_joined = 1

  }
  
  export interface Notification {
    GameId: string,
    users: [],
    timestamp: number,
    status: string,
    room: string,
    Moves: string,
  }