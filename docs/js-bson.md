## JS BSON

### Base data type:

| DEC | BIN  | type        | content length                              |
| --- | ---- | ----------- | ------------------------------------------- |
| 0   | 0000 | void        | 0 (Represents termination in map and array) |
| 1   | 0001 | null        | 0                                           |
| 2   | 0010 | undefined   | 0                                           |
| 3   | 0011 | true        | 0                                           |
| 4   | 0100 | false       | 0                                           |
| 5   | 0101 | int         | 4                                           |
| 6   | 0110 | bigint      | 8                                           |
| 7   | 0111 | double      | 8                                           |
| 8   | 1000 | \*objectId  | dynamicLenData                              |
| 9   | 1001 | arrayBuffer | contentLen(dynamicLenData) + content        |
| 10  | 1010 | \*string    | arrayBuffer                                 |
| 11  | 1011 | \*regExp    | string                                      |
| 12  | 1100 | function    | string[]&string //暂未实现                  |
| 13  | 1101 | array       | n                                           |
| 14  | 1110 | map(json)   | n                                           |
| 15  | 1111 | \*buffer    | arrayBuffer                                 |

+1_0000 :

| DEC | BIN  | type     | content length |
| --- | ---- | -------- | -------------- |
| 16  | 0000 | \*Error  | map            |
| 17  | 0001 | \*symbol |                |
| 18  | 0010 |          |                |
| 19  | 0011 |          |                |
| 20  | 0100 |          |                |
| 21  | 0101 |          |                |
| 22  | 0110 |          |                |
| 23  | 0111 |          |                |
| 24  | 1000 |          |                |
| 25  | 1001 |          |                |
| 26  | 1010 |          |                |
| 27  | 1011 |          |                |
| 28  | 1100 |          |                |
| 29  | 1101 |          |                |
| 30  | 1110 |          |                |
| 31  | 1111 |          |                |

#### BSON Array:

```
|--1-|---n---|  |--1-|---n---| ... |--1-|---n---| |--1-|
|type|content|  |type|content| ... |type|content| |void|

```

#### BSON Map:

```
|--1-|<dynamicContent>|---n---|  |--1-|<dynamicContent>|---n---| ... |--1-|<dynamicContent>|---n---| |--1-|
|type|      key       |content|  |type|      key       |content| ... |type|      key       |content| |void|

```

#### dynamicLenData

| byte | max               | real    | content                          |
| ---- | ----------------- | ------- | -------------------------------- |
| 1    | 0x7f              | 7bit    | 0xxxxxxx                         |
| 2    | 0x3fff            | 6bit 1B | 10xxxxxx ff                      |
| 3    | 0x1fffff          | 5bit 2B | 110xxxxx ff ff                   |
| 4    | 0xfffffff(255MB)  | 4bit 3B | 1110xxxx ff ff ff                |
| 5    | 0x7_ffffffff      | 3bit 4B | 11110xxx ff ff ff ff             |
| 6    | 0x3ff_ffffffff    | 2bit 5B | 111110xx ff ff ff ff ff          |
| 7    | 0x1ffff_ffffffff  | 1bit 6B | 1111110x ff ff ff ff ff ff       |
|      |                   |         |                                  |
| 8    | 0xffffff_ffffffff | 7B      | 11111110 ff ff ff ff ff ff ff    |
| 9    |                   | 8B      | 11111111 ff ff ff ff ff ff ff ff |

number(47 bit): 0~512 TB - 1
id(7 bytes): 0~65535 TB -1

#### dynamicContent

```
<dynamicLenData> content
```
