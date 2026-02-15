export enum OrderStatus {
  COMPLETED = 'completed',
  CANDELLED = 'cancelled',
  ERROR = 'error',
  PROCESSING = 'processing',
}

export const getOrderStatus = (status: string): OrderStatus | undefined => {
  return Object.values(OrderStatus).find((orderStatus) => orderStatus === status);
}
