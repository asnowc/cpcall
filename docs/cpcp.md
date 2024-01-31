### RPC 数据帧格式:

```
|---8bit---|---n---|
|Frame type|Content|
```

| dec | binary | DESC     | content length  | DESC            |
| --- | ------ | -------- | --------------- | --------------- |
| 0   | 0000   |          |                 |                 |
| 1   | 0001   | call     | array (no void) |                 |
| 2   | 0010   | exec     | array (no void) |                 |
| 3   | 0011   |          |                 |                 |
| 4   | 0100   |          |                 |                 |
| 5   | 0101   |          |                 |                 |
| 6   | 0110   |          |                 |                 |
| 7   | 0111   | response | int             | 响应异常        |
| 8   | 1000   | promise  | DBN             | 返回 Promise    |
| 9   | 1001   | resolve  | n               | promise resolve |
| 10  | 1010   | reject   | n               | promise reject  |
| 11  | 1011   | return   | n               |                 |
| 12  | 1100   | throw    | same return     |                 |

| dec | binary    | Frame type length | content length |
| --- | --------- | ----------------- | -------------- |
| 16  | 0001_0000 |                   |                |
| 17  | 0001_0001 |                   |                |
|     |           |                   |                |
| 20  | 0001_0100 |                   |                |
| 254 | 11111110  | end               | 0              |
| 255 | 11111111  | disable           | 0              |

### All types of content:

#### return:

```
|8bit| |--n--|
 type    data
```

#### throw:

```
|8bit| |--n--|
 type    data
```

#### promise

```
<--DBN-->
 asyncId
```

#### resolve:

```
<--DBN--> <return>
 asyncId
```

#### reject:

```
<--DBN--> |8bit| |--n--|
 asyncId   type    data
```
