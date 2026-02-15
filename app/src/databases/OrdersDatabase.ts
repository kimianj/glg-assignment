import {
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";

import { Order } from "../definitions/entities/Order";
import { OrderStatus } from "../definitions/enums/OrderStatus";
import { DynamoService } from "../services/dynamo/DynamoService";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

interface GetOrdersParams {
  userId?: string;
  status?: OrderStatus;
  referenceId?: string;
  count: number;
}

const { DYNAMO_TABLE_ORDERS } = process.env;

export class OrdersDatabase {
  public static async createOrder(order: Order): Promise<void> {
    const client = DynamoService.getClient();
    if (!DYNAMO_TABLE_ORDERS) throw new Error("DYNAMO_TABLE_ORDERS is not defined");

    const command = new PutItemCommand({
      TableName: DYNAMO_TABLE_ORDERS,
      Item: marshall(order, { removeUndefinedValues: true }),
    });

    await client.send(command);
  }

  public static async getOrders(params: GetOrdersParams): Promise<Order[]> {
    const client = DynamoService.getClient();
    if (!DYNAMO_TABLE_ORDERS) throw new Error("DYNAMO_TABLE_ORDERS is not defined");

    const { count } = params;

    /* Build filter expression */
    const filterExpression: Array<string> = [];
    const expressionAttributeValues: Record<string, any> = {};
    /**
     * BUG FIX: The original code used #name placeholders (e.g. #userId, #status)
     * in FilterExpression but never defined ExpressionAttributeNames.
     * This is required by DynamoDB, especially because 'status' is a reserved word.
     */
    const expressionAttributeNames: Record<string, string> = {};

    const filters = ['userId', 'status', 'referenceId'] as const;
    for (const filter of filters) {
      if (params[filter]) {
        filterExpression.push(`#${filter} = :${filter}`);
        expressionAttributeNames[`#${filter}`] = filter;
        expressionAttributeValues[`:${filter}`] = { S: params[filter] };
      }
    }

    const command = new ScanCommand({
      TableName: DYNAMO_TABLE_ORDERS,
      Limit: count,
      FilterExpression: filterExpression.length > 0 ? filterExpression.join(" AND ") : undefined,
      ExpressionAttributeNames: filterExpression.length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: filterExpression.length > 0 ? expressionAttributeValues : undefined,
      Select: "ALL_ATTRIBUTES"
    });

    const response = await client.send(command);
    if (!response.Items) return [];

    return response.Items.map((item) => unmarshall(item) as Order);
  }

  public static async getOrderById(orderId: string): Promise<Order | null> {
    const client = DynamoService.getClient();
    if (!DYNAMO_TABLE_ORDERS) throw new Error("DYNAMO_TABLE_ORDERS is not defined");

    const command = new GetItemCommand({
      TableName: DYNAMO_TABLE_ORDERS,
      Key: { orderId: { S: orderId } },
    });

    const response = await client.send(command);
    if (!response.Item) return null;
    return unmarshall(response.Item) as Order;
  }

  public static async getOrderByReferenceId(referenceId: string): Promise<Order | null> {
    const client = DynamoService.getClient();
    if (!DYNAMO_TABLE_ORDERS) throw new Error("DYNAMO_TABLE_ORDERS is not defined");

    const command = new QueryCommand({
      TableName: DYNAMO_TABLE_ORDERS,
      IndexName: "referenceIdIndex",
      KeyConditionExpression: "referenceId = :referenceId",
      ExpressionAttributeValues: {
        ":referenceId": referenceId,
      },
      Select: "ALL_ATTRIBUTES",
      Limit: 1,
    });

    const response = await client.send(command);
    if (!response.Items || response.Items.length === 0) return null;
    return response.Items[0] as Order;
  }

  /**
   * Updates the status of an order and sets updatedAt timestamp.
   * Optionally sets completedAt for terminal states.
   */
  public static async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    additionalFields?: Partial<Pick<Order, "completedAt" | "receiptFilePath" | "details">>
  ): Promise<Order | null> {
    const client = DynamoService.getClient();
    if (!DYNAMO_TABLE_ORDERS) throw new Error("DYNAMO_TABLE_ORDERS is not defined");

    let updateExpression = "SET #status = :status, #updatedAt = :updatedAt";
    const expressionAttributeNames: Record<string, string> = {
      "#status": "status",
      "#updatedAt": "updatedAt",
    };
    const expressionAttributeValues: Record<string, any> = {
      ":status": { S: status },
      ":updatedAt": { N: `${Date.now()}` },
    };

    if (additionalFields?.completedAt) {
      updateExpression += ", #completedAt = :completedAt";
      expressionAttributeNames["#completedAt"] = "completedAt";
      expressionAttributeValues[":completedAt"] = { N: `${additionalFields.completedAt}` };
    }

    if (additionalFields?.receiptFilePath) {
      updateExpression += ", #receiptFilePath = :receiptFilePath";
      expressionAttributeNames["#receiptFilePath"] = "receiptFilePath";
      expressionAttributeValues[":receiptFilePath"] = { S: additionalFields.receiptFilePath };
    }

    const command = new UpdateItemCommand({
      TableName: DYNAMO_TABLE_ORDERS,
      Key: { orderId: { S: orderId } },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    });

    const response = await client.send(command);
    if (!response.Attributes) return null;
    return unmarshall(response.Attributes) as Order;
  }

  public static async deleteOrder(orderId: string): Promise<void> {
    const client = DynamoService.getClient();
    if (!DYNAMO_TABLE_ORDERS) throw new Error("DYNAMO_TABLE_ORDERS is not defined");

    const command = new DeleteItemCommand({
      TableName: DYNAMO_TABLE_ORDERS,
      Key: { orderId: { S: orderId } },
    });

    await client.send(command);
  }
}