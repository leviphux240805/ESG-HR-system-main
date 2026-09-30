import { IS_DEMO } from "../source";
import { httpTransport } from "./http";
import { mockTransport } from "./mock";

/** Lớp vận chuyển request; đổi giữa backend thật và dữ liệu giả mà không đụng vào code module. */
export type Transport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const transport: Transport = IS_DEMO ? mockTransport : httpTransport;
