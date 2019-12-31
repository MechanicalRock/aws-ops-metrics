import { DynamoDB } from 'aws-sdk';

const TABLE_NAME: string = process.env.TABLE_NAME ? process.env.TABLE_NAME : "EventStore";

export const createDbEntry = async (payload: { id: string; resourceId: string;[key: string]: any }) => {
  const db = new DynamoDB.DocumentClient();
  return await db
    .put({
      TableName: TABLE_NAME,
      Item: payload,
    })
    .promise();
};


export const getDbEntryById = async (id: string, resourceId: string) => {
  const db = new DynamoDB.DocumentClient();
  return (await db
    .get({
      TableName: TABLE_NAME,
      Key: {
        id,
        resourceId,
      },
    })
    .promise()).Item;
};

export const queryAllUnbookmaredEvents = async (pipelineName: string) => {
  const db = new DynamoDB.DocumentClient();
  const queryInput: DynamoDB.DocumentClient.QueryInput = {
    TableName: TABLE_NAME,
    IndexName: "pipelineName-index",
    KeyConditionExpression: 'pipelineName = :name and bookmarked = :value',
    ExpressionAttributeValues: {
      ':name': pipelineName,
      ':value': "N"
    }
  };
  const results = await db.query(queryInput).promise();
  return results;
};


export const getLastItemById = async (id: string) => {
  const db = new DynamoDB.DocumentClient();
  const queryInput: DynamoDB.DocumentClient.QueryInput = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':id': id
    },
    Limit: 1,
    ScanIndexForward: false
  };
  const results = await db.query(queryInput).promise();
  return results;
};
