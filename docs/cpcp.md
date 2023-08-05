### Cross-process call protocol(CPCP) 数据帧格式:

```
|---8bit---|---n---|
|Frame type|Content|
```

| dec | binary | DESC               | content length |
| --- | ------ | ------------------ | -------------- |
| 0   | 0000   | exec               |                |
| 1   | 0001   | call               | n              |
| 2   | 0010   | call ignore return | same call      |
| 3   | 0011   | exec ignore return |                |
| 4   | 0100   |                    |                |
| 5   | 0101   |                    |                |
| 6   | 0110   |                    |                |
| 7   | 0111   | actionResponse     | same return    |
| 8   | 1000   | return promise     |                |
| 9   | 1001   | promise resolve    | n              |
| 10  | 1010   | promise reject     | n              |
| 11  | 1011   | return             | n              |
| 12  | 1100   | throw              | same return    |

| dec | binary    | Frame type length | content length |
| --- | --------- | ----------------- | -------------- |
| 16  | 0001_0000 |                   |                |
| 17  | 0001_0001 |                   |                |
|     |           |                   |                |
| 20  | 0001_0100 |                   |                |
| 255 | 11111111  | fin               | 0              |

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

if (type === void) throw CpcUnregisteredCommandError

#### return async

```
<dynamicLenData>
    asyncId
```

#### async resolve:

```
<dynamicLenData> <return>
    asyncId
```

#### async reject:

```
<dynamicLenData> <throw>
    asyncId
```

#### call/call ignore return:

```
<dynamicLenData> |cmdLen| <args>
     cmdLen      command  <args>
```

#### mapping call:

```
<dynamicLenData>   <args>
     command       <args>
```

#### dynamicLenData

| byte | max              | real    | content                                                                 |
| ---- | ---------------- | ------- | ----------------------------------------------------------------------- |
| 1    | 0x7f             | 7bit    | 0xxxxxxx                                                                |
| 2    | 0x3fff           | 6bit 1B | 1xxxxxxx 0xxxxxxx                                                       |
| 3    | 0x1fffff         | 5bit 2B | 1xxxxxxx 1xxxxxxx 0xxxxxxx                                              |
| 4    | 0xfffffff(255MB) | 4bit 3B | 1xxxxxxx 1xxxxxxx 1xxxxxxx 0xxxxxxx                                     |
| 5    | 0x7ffffffff      | 3bit 4B | 1xxxxxxx 1xxxxxxx 1xxxxxxx 1xxxxxxx 0xxxxxxx                            |
| 6    | 0x3ffffffffff    | 2bit 5B | 1xxxxxxx 1xxxxxxx 1xxxxxxx 1xxxxxxx 1xxxxxxx 0xxxxxxx                   |
| 7    | 0x1ffffffffffff  | 1bit 6B | 1xxxxxxx 1xxxxxxx 1xxxxxxx 1xxxxxxx 1xxxxxxx 1xxxxxxx 0xxxxxxx          |
| 8    |                  | 7B      | 1xxxxxxx 1xxxxxxx 1xxxxxxx 1xxxxxxx 1xxxxxxx 1xxxxxxx 1xxxxxxx 0xxxxxxx |

0~65535 TB
