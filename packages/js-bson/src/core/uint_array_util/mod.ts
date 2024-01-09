import * as numTransf from "./number.js";

import { decodeUtf8, encodeUtf8 } from "./string.js";
export const strTransf = { readByUtf8: decodeUtf8, writeByUtf8: encodeUtf8 };
export { numTransf };
