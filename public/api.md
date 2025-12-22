CTFile REST API v1 开发文档
欢迎使用 CTFile REST API。本文档将帮助您快速集成 CTFile 的文件存储和分享功能。

 基础信息
API 基础地址: https://rest.ctfile.com/v1
所有请求均使用 POST 方法
请求和响应格式: JSON
快速开始
阅读认证说明，了解如何进行 API 认证
选择您需要的 API 接口
查看请求参数和返回示例
开始集成到您的应用中
认证说明
CTFile API 使用基于 Session Token 的认证机制

 重要提示：开放接口 Session 获取
如果您需要开发接口集成 CTFile 服务，请注意：

开发接口的 session token 需要通过「开放接口登录密钥管理」功能获取，而不是通过本文档中的登录接口。

- 登录 CTFile 网站后台
- 进入「开放接口登录密钥管理」页面
- 生成或查看您的开放接口专用 session token
- 使用该 token 调用需要认证的 API 接口

本文档中的 /v1/user/auth/login 接口主要用于移动应用或客户端登录，不适用于服务端集成。
认证流程（移动应用/客户端）
调用登录接口获取 session token
在后续请求中携带 session 参数
Session 有效期为 3 天，过期后需要重新登录
 注意事项
- 除浏览器 API 外，其他 API 均需要登录认证
- 浏览器 API 使用 xtlink 参数进行访问控制
- 请妥善保管您的 session token，避免泄露
错误码说明
API 返回的常见错误码及其含义

200
请求成功
400
请求参数错误或资源不存在
401
未登录或 session 已过期
403
权限不足或配额超限
405
方法不支持或模块不存在
429
请求过于频繁
500
服务器内部错误
POST
/v1/user/auth/login_sms_code
获取登录短信验证码
向指定手机号发送登录验证码，用于手机号登录。

请求参数
参数名	类型	必填	说明
phone	string	必填	11位中国大陆手机号
请求示例
{
  "phone": "13800138000"
}
成功响应
{
  "code": 200,
  "vc_timestamp": 1699999999,
  "vc_checksum": "a1b2c3d4e5f6..."
}
错误响应
{
  "code": 400,
  "message": "手机号未注册，请先注册账号"
}
POST
/v1/user/auth/login
用户登录
支持邮箱密码登录和手机验证码登录两种方式。

请求参数（邮箱登录）
参数名	类型	必填	说明
email	string	必填	用户邮箱
password	string	必填	用户密码（6-30个字符）
unique_id	string	可选	设备唯一标识
device_id	string	可选	设备ID
请求参数（手机验证码登录）
参数名	类型	必填	说明
phone	string	必填	手机号
verifyCode	string	必填	短信验证码
vc_timestamp	integer	必填	验证码时间戳
vc_checksum	string	必填	验证码校验和
请求示例（邮箱登录）
{
  "email": "user@example.com",
  "password": "your_password",
  "unique_id": "device_unique_id",
  "device_id": "device_identifier"
}
请求示例（手机验证码登录）
{
  "phone": "13800138000",
  "verifyCode": "123456",
  "vc_timestamp": 1699999999,
  "vc_checksum": "a1b2c3d4e5f6..."
}
成功响应
{
  "code": 200,
  "token": "f924c2ae06b14157403b7ad4ca93a9aa"
}
 提示
登录成功后，返回的 token 即为 session 值，请在后续请求中使用此 token 进行认证。
POST
/v1/user/info/profile
获取用户资料
获取当前登录用户的基本信息和会员状态。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
请求示例
{
  "session": "f924c2ae06b14157403b7ad4ca93a9aa"
}
成功响应
{
  "code": 200,
  "userid": 12345,
  "username": "user123",
  "nick_name": "昵称",
  "group_type": 1,
  "group_name": "普通用户",
  "has_avatar": 1234,
  "avatar_url": "https://imgstatic.ctfile.com/upload/profile/xxx.jpg",
  "reg_time": "2023-01-01 00:00:00",
  "is_vip": 0,
  "is_realname": false,
  "max_filesize": 1073741824
}
POST
/v1/user/info/quota
获取存储配额
获取用户的存储空间使用情况，包括公有云和私有云。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
请求示例
{
  "session": "f924c2ae06b14157403b7ad4ca93a9aa"
}
成功响应
{
  "code": 200,
  "max_storage": 10737418240,
  "max_private_storage": 5368709120,
  "space_used": 1073741824,
  "private_space_used": 536870912,
  "total_files": 100,
  "total_private_files": 50
}
 字段说明
- max_storage: 公有云总容量（字节）
- max_private_storage: 私有云总容量（字节）
- space_used: 公有云已使用空间（字节）
- private_space_used: 私有云已使用空间（字节）
- total_files: 公有云文件+文件夹总数
- total_private_files: 私有云文件+文件夹总数
POST
/v1/user/info/bandwidth
获取带宽信息
获取 VIP 用户的带宽使用情况（普通用户返回 0）。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
成功响应
{
  "code": 200,
  "bandwidth_total": 107374182400,
  "bandwidth_remaining": 53687091200,
  "bandwidth_used": 53687091200,
  "max_yun": 10
}
POST
/v1/user/info/history
查看历史记录
获取用户最近查看的文件记录（最多50条）。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
成功响应
{
  "code": 200,
  "results": [
    {
      "file_id": "f123456",
      "file_name": "document.pdf",
      "file_extension": "pdf",
      "icon": "pdf",
      "namespace": "public",
      "date": 1699999999,
      "add_time": "2023-11-15 10:30:00"
    }
  ]
}
POST
/v1/browser/file/validate
验证分享链接
验证 xtlink 分享链接的有效性，并获取分享者信息。

请求参数
参数名	类型	必填	说明
xtlink	string	必填	分享链接代码（支持 xturl 和 xtc 格式）
请求示例
{
  "xtlink": "xtc61380487-d67238530-c7daf9-5124"
}
成功响应
{
  "code": 200,
  "xtlink": {
    "userid": 61380487,
    "displayName": "用户昵称",
    "avatarUrl": "https://imgstatic.ctfile.com/upload/profile/xxx.jpg",
    "link": "xtc61380487-d67238530-c7daf9-5124",
    "tags": [],
    "perm": "r"
  }
}
 链接格式说明
- xturl 格式: 无需密码，直接访问
- xtc 格式: 需要密码验证，格式为 xtc{userid}-{id}-{checksum}-{password}
POST
/v1/browser/file/list
列出文件和文件夹
根据 xtlink 列出分享的文件和文件夹，支持搜索和筛选。

请求参数
参数名	类型	必填	说明
xtlink	string	必填	分享链接代码
folder_id	string	可选	文件夹ID（默认 "d0" 表示根目录）
keyword	string	可选	搜索关键词（至少3个字符）
filter	string	可选	文件类型筛选：all/video/music/picture/document/app/zip/other
orderby	string	可选	排序方式：new/old/az/za/big/small
start	integer	可选	分页起始位置（默认 0）
session	string	可选	如果已登录，可传入 session
请求示例
{
  "xtlink": "xtc61380487-d67238530-c7daf9-5124",
  "filter": "",
  "folder_id": "d0",
  "orderby": "old",
  "keyword": "小苹果",
  "session": "f924c2ae06b14157403b7ad4ca93a9aa"
}
成功响应
{
  "code": 200,
  "num": 10,
  "folder_id": "d0",
  "folder_path": "/我的文件夹",
  "results": [
    {
      "key": "d123",
      "icon": "folder",
      "name": "我的文件夹",
      "date": "2023-11-15 10:30:00",
      "status": 1
    },
    {
      "key": "f456",
      "icon": "mp3",
      "name": "小苹果.mp3",
      "imgsrc": "https://thumbnails.ctfile.com/audio/abc123.mp3",
      "size": 5242880,
      "date": "2023-11-15 10:30:00",
      "xturl": "ctfile://xturlABC123...",
      "xtid": "ABC123...",
      "status": 1
    }
  ]
}
 字段说明
- num: 当前返回的结果数量（不是总数）
- folder_path: 当前文件夹的完整路径
- imgsrc: 缩略图地址（图片/视频/音频文件有效）
- xturl: 小通链接（xturl 格式）
- xtid: 加密的文件ID，用于获取下载链接
错误响应（未登录）
{
  "code": 401,
  "message": "未登录"
}
POST
/v1/browser/file/download
准备下载文件
获取指定文件和文件夹的下载信息列表。

请求参数
参数名	类型	必填	说明
xtlink	string	必填	分享链接代码
ids	string	必填	文件/文件夹ID列表，逗号分隔（如 "f123,d456"）
请求示例
{
  "xtlink": "xtc61380487-d67238530-c7daf9-5124",
  "ids": "f123456,d789012"
}
成功响应
{
  "code": 200,
  "results": [
    {
      "key": "f123456",
      "icon": "pdf",
      "userid": 61380487,
      "name": "document.pdf",
      "size": 1048576,
      "path": "/"
    },
    {
      "key": "f789012",
      "icon": "mp4",
      "userid": 61380487,
      "name": "video.mp4",
      "size": 52428800,
      "path": "/我的文件夹/"
    }
  ]
}
POST
/v1/browser/file/save
转存文件到自己的空间
将分享的文件或文件夹转存到自己的账号中。需要登录。

请求参数
参数名	类型	必填	说明
xtlink	string	必填	分享链接代码
ids	string	必填	文件/文件夹ID列表，逗号分隔
session	string	必填	登录获取的 session token
请求示例
{
  "xtlink": "xtc61380487-d67238530-c7daf9-5124",
  "ids": "f123456,d789012",
  "session": "f924c2ae06b14157403b7ad4ca93a9aa"
}
成功响应
{
  "code": 200,
  "message": "文件/文件夹已保存"
}
错误响应（超过限制）
{
  "code": 403,
  "message": "转存总数(150个)超过限制(100个)，请升级会员"
}
 转存说明
- 转存的文件会保存在"来自{分享者}的分享"文件夹中
- 不同会员等级有不同的转存数量限制
- 转存会复制文件，不占用额外存储空间（引用计数）
POST
/v1/browser/file/meta
获取文件元数据
获取文件的详细信息，包括名称、大小、描述等。

请求参数
参数名	类型	必填	说明
xtlink	string	必填	分享链接代码
file_id	string	必填	文件ID（不带 f 前缀）
请求示例
{
  "xtlink": "xtc61380487-d67238530-c7daf9-5124",
  "file_id": "123456"
}
成功响应
{
  "code": 200,
  "key": "f123456",
  "file_id": 123456,
  "name": "document.pdf",
  "description": "文件描述",
  "size": 1048576,
  "date": "2023-11-15 10:30:00",
  "views": 100,
  "extension": "pdf",
  "icon": "pdf"
}
POST
/v1/browser/file/ids_list
批量获取文件信息
根据文件/文件夹 ID 列表批量获取详细信息。

请求参数
参数名	类型	必填	说明
xtlink	string	必填	分享链接代码
ids	string	必填	文件/文件夹ID列表，逗号分隔（如 "f123,d456"）
onlyFiles	boolean	可选	是否只返回文件（不包含文件夹）
成功响应
{
  "code": 200,
  "results": [
    {
      "key": "d123",
      "icon": "folder",
      "name": "我的文件夹",
      "date": "2023-11-15 10:30:00",
      "status": 1
    },
    {
      "key": "f456",
      "icon": "pdf",
      "name": "document.pdf",
      "imgsrc": "",
      "size": 1048576,
      "date": "2023-11-15 10:30:00",
      "status": 1
    }
  ]
}
POST
/v1/public/file/upload
获取上传地址
获取文件上传 URL。实际文件上传需要通过返回的 upload_url 进行。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
folder_id	string	可选	上传到指定文件夹ID（默认0为根目录）
请求示例
{
  "session": "f924c2ae06b14157403b7ad4ca93a9aa",
  "folder_id": "0"
}
成功响应
{
  "code": 200,
  "upload_url": "https://upload.ctfile.com/web/upload.do?userid=12345&maxsize=50000000000&folderid=0&workspaceid=123&ctt=1699999999&key=abc123..."
}
 上传说明
- 先调用此接口获取 upload_url
- 使用 multipart/form-data 方式 POST 文件到 upload_url
- upload_url 包含所有必要的参数（userid, maxsize, folderid, workspaceid, ctt, key）
- upload_url 有效期为 24 小时（ctt 参数）
- 最大文件大小：50GB（maxsize 参数）
POST
/v1/public/file/share
分享文件
创建文件或文件夹的分享链接。支持批量分享多个文件/文件夹。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
ids	string	必填	文件/文件夹ID列表，逗号分隔（如 "f123,d456"）
请求示例
{
  "session": "f924c2ae06b14157403b7ad4ca93a9aa",
  "ids": "f123456,d789012"
}
成功响应
{
  "code": 200,
  "results": [
    {
      "key": "f123456",
      "icon": "pdf",
      "name": "document.pdf",
      "weblink": "https://url.ctfile.com/f/12345-67890-abcdef （访问密码：1234）",
      "xtcode": "ctfile://xtc12345-f67890-abcdef-1234",
      "drlink": "https://drfs.ctcontents.com/file/12345/67890/abcdef/document.pdf",
      "size": 1048576,
      "date": "2023-11-15 10:30:00"
    },
    {
      "key": "d789012",
      "icon": "folder",
      "name": "我的文件夹",
      "weblink": "https://url.ctfile.com/d/12345-789012-abcdef",
      "xtcode": "ctfile://xtc12345-d789012-abcdef-1234",
      "drlink": null,
      "size": 0,
      "date": "2023-11-15 11:00:00"
    }
  ]
}
 字段说明
- weblink: 网页访问链接（如果有密码会显示在链接后）
- xtcode: 小通链接，用于移动端或API访问
- drlink: 直链地址，仅文件有效，文件夹为 null
- 访问密码：使用账户的默认密码或全局密码
POST
/v1/public/file/delete
删除文件
将文件或文件夹移至回收站。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
ids	string	必填	文件/文件夹ID列表，逗号分隔
成功响应
{
  "code": 200,
  "message": "文件已删除"
}
POST
/v1/public/folder/create
创建文件夹
在指定位置创建新文件夹。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
name	string	必填	文件夹名称
folder_id	string	可选	父文件夹ID（默认0为根目录）
description	string	可选	文件夹描述
is_hidden	boolean	可选	是否隐藏文件夹
请求示例
{
  "session": "f924c2ae06b14157403b7ad4ca93a9aa",
  "name": "我的文件夹",
  "folder_id": "0",
  "description": "这是一个测试文件夹",
  "is_hidden": false
}
成功响应
{
  "code": 200,
  "message": "文件夹创建成功",
  "folder_id": "d123456",
  "path": "/我的文件夹"
}
错误响应
{
  "code": 403,
  "message": "该文件夹名已经存在",
  "folder_id": "d123456",
  "folder_path": "/我的文件夹"
}
POST
/v1/public/folder/list
列出文件夹
列出指定文件夹下的所有子文件夹。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
folder_id	string	可选	文件夹ID（默认0为根目录）
orderby	string	可选	排序方式：new/old/az/za/big/small
成功响应
{
  "code": 200,
  "folder_path": "/",
  "results": [
    {
      "key": "d123",
      "icon": "folder",
      "name": "文档",
      "date": "2023-11-15 10:30:00"
    },
    {
      "key": "d456",
      "icon": "folder",
      "name": "图片",
      "date": "2023-11-15 11:00:00"
    }
  ]
}
POST
/v1/public/file/list
列出文件（完整版）
列出用户自己的文件，支持筛选、搜索、分页等功能。与 browser API 类似，但用于管理自己的文件。

 提示
此接口参数与 /v1/browser/file/list 类似，但需要 session 认证，且返回的是用户自己的文件列表。
POST
/v1/union/info/income
获取收益信息
获取用户的联盟收益统计信息，包括今日收益、总收益等。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
成功响应
{
  "code": 200,
  "account_mode": 5,
  "account_mode_info": "高收益模式已开启",
  "account_type": "普通账户",
  "user_level": 2,
  "today_income": 12.50,
  "today_clicked": 150,
  "aspire_income": 1250.00,
  "unpaid_income": 350.00,
  "paid_income": 900.00
}
 字段说明
- account_mode: 收益模式（0=关闭，1=低收益，2=临时低收益，5+=高收益）
- today_income: 今日收益金额
- today_clicked: 今日点击次数
- aspire_income: Aspire 总收益
- unpaid_income: 未支付收益
- paid_income: 已支付收益
POST
/v1/union/info/switch_mode
切换收益模式
切换联盟收益模式（低收益/高收益/关闭）。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
mode	integer	必填	收益模式：0=关闭，1=低收益，5+=高收益
请求示例
{
  "session": "f924c2ae06b14157403b7ad4ca93a9aa",
  "mode": 5
}
成功响应
{
  "code": 200,
  "message": "高收益模式已开启"
}
 注意
某些账户可能无法切换收益模式，会返回错误提示。
POST
/v1/browser/file/fetch_url
获取文件下载链接
获取单个文件的实际下载地址。

请求参数
参数名	类型	必填	说明
xtlink	string	必填	分享链接代码
file_id	string	必填	文件ID（不带 f 前缀）
carrier	integer	可选	运营商节点选择
成功响应
{
  "code": 200,
  "download_url": "https://download.ctfile.com/..."
}
POST
/v1/public/file/fetch_url
获取文件下载链接（自己的文件）
获取用户自己文件的下载地址。VIP用户有更高的下载速度。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
file_id	string	必填	文件ID（不带 f 前缀）
carrier	integer	可选	运营商节点选择
成功响应
{
  "code": 200,
  "download_url": "https://download.ctfile.com/..."
}
 下载速度
- VIP用户：根据会员等级享受更高的下载速度
- 普通用户：限速 30KB/s，前半部分限速 50KB/s
POST
/v1/public/file/move
移动文件
将文件或文件夹移动到指定位置。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
ids	string	必填	文件/文件夹ID列表，逗号分隔
folder_id	string	必填	目标文件夹ID（0为根目录）
成功响应
{
  "code": 200,
  "message": "文件/文件夹已移动到新的位置"
}
 注意
不能将文件夹移动到自身或其子文件夹中。
POST
/v1/public/file/meta
获取文件元数据（自己的文件）
获取用户自己文件的详细元数据信息。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
file_id	string	必填	文件ID（不带 f 前缀）
成功响应
{
  "code": 200,
  "key": "f123456",
  "file_id": 123456,
  "name": "document.pdf",
  "description": "文件描述",
  "size": 1048576,
  "date": "2023-11-15 10:30:00",
  "views": 100,
  "downloads": 50,
  "extension": "pdf",
  "icon": "pdf",
  "folder_id": "d0",
  "path": "/",
  "is_locked": 0,
  "pinned": 0
}
POST
/v1/public/file/modify_meta
修改文件元数据
修改文件的名称、描述等信息。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
file_id	string	必填	文件ID（不带 f 前缀）
name	string	可选	新文件名
description	string	可选	文件描述
is_locked	boolean	可选	是否锁定文件
成功响应
{
  "code": 200,
  "message": "文件信息修改成功"
}
POST
/v1/public/folder/meta
获取文件夹元数据
获取文件夹的详细信息。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
folder_id	string	必填	文件夹ID（不带 d 前缀）
成功响应
{
  "code": 200,
  "key": "d123456",
  "key_id": 123456,
  "name": "我的文件夹",
  "description": "文件夹描述",
  "path": "/",
  "date": "2023-11-15 10:30:00",
  "parent_folder_id": 0,
  "folder_count": 5,
  "document_count": 20,
  "total_size": 10485760,
  "is_hidden": 0,
  "pinned": 0,
  "icon": "folder",
  "folder_id": "d0"
}
POST
/v1/public/folder/modify_meta
修改文件夹信息
修改文件夹的名称、描述等信息。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
folder_id	string	必填	文件夹ID（不带 d 前缀）
name	string	可选	新文件夹名称
description	string	可选	文件夹描述
is_hidden	boolean	可选	是否隐藏文件夹
is_rename	boolean	可选	是否只重命名（不修改其他信息）
成功响应
{
  "code": 200,
  "message": "文件夹信息修改成功"
}
 注意
重命名文件夹会自动更新所有子文件夹的路径信息。
POST
/v1/user/info/modify_sms_code
获取修改信息的短信验证码
用于修改用户信息时的手机验证。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
phone	string	可选	手机号（不传则使用账户绑定的手机号）
成功响应
{
  "code": 200,
  "vc_timestamp": 1699999999,
  "vc_checksum": "a1b2c3d4e5f6..."
}
POST
/v1/public/file/ids_list
批量获取文件信息（自己的文件）
根据文件/文件夹 ID 列表批量获取详细信息。

请求参数
参数名	类型	必填	说明
session	string	必填	登录获取的 session token
ids	string	必填	文件/文件夹ID列表，逗号分隔
onlyFiles	boolean	可选	是否只返回文件
成功响应
{
  "code": 200,
  "results": [
    {
      "key": "f123",
      "icon": "pdf",
      "name": "document.pdf",
      "imgsrc": "",
      "size": 1048576,
      "date": "2023-11-15 10:30:00",
      "status": 1
    }
  ]
}