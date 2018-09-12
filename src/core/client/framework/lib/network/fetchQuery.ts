import { FetchFunction } from "relay-runtime";

import {
  BadUserInputError,
  GraphQLError,
  NetworkError,
  UnknownServerError,
} from "../errors";

// Normalize errors.
function getError(errors: Error[]): Error {
  if (errors.length > 1) {
    // Multiple errors are GraphQL errors.
    // TODO: (cvle) Is this assumption correct?
    return new GraphQLError(errors as any);
  }
  const err = errors[0] as Error;
  if ((err as any).extensions) {
    if ((err as any).code === "BAD_USER_INPUT") {
      return new BadUserInputError((err as any).extensions);
    }
    return new UnknownServerError(err.message, (err as any).extensions);
  }
  // No extensions == GraphQL error.
  // TODO: (cvle) harmonize with server.
  return new GraphQLError(errors as any);
}

export type TokenGetter = () => string;
type CreateFetch = (token?: TokenGetter) => FetchFunction;

/**
 * createFetch returns a simple implementation of the `FetchFunction`
 * required by Relay. It'll return a `NetworkError` on failure.
 */
const createFetch: CreateFetch = tokenGetter => async (
  operation,
  variables
) => {
  const token = tokenGetter && tokenGetter();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const response = await fetch("/api/tenant/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: operation.text,
        variables,
      }),
    });
    if (response.status >= 500) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data.errors) {
      throw getError(data.errors);
    }
    return data;
  } catch (err) {
    if (err instanceof TypeError) {
      throw new NetworkError(err);
    }
    throw err;
  }
};

export default createFetch;