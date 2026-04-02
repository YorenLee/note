### 更换镜像源
```plain
sudo mkdir -p /etc/docker # 创建docker配置文件
vim /etc/docker/daemon.json # 编辑配置文件
```

```plain

{
    "registry-mirrors": [
        "https://docker.1ms.run",
        "https://registry.docker-cn.com",			
        "https://dockerhub.azk8s.cn",
        "https://mirror.baidubce.com", 
        "https://docker.mirrors.ustc.edu.cn", 
        "https://hub-mirror.c.163.com",          
        "https://docker.nju.edu.cn",              
        "https://docker.m.daocloud.io"           
    ]

}
```

[https://github.com/dongyubin/DockerHub](https://github.com/dongyubin/DockerHub) 可以看看国内的加速源

```plain
sudo systemctl daemon-reexec 
sudo systemctl restart docker
docker info # 查看配置是否生效
```

### 拉取镜像
```plain
docker pull 镜像名称
```

### 查看镜像 
```plain
docker images
```

### 删除镜像
```plain
docker rmi [imageName]
```

### 镜像生成容器
```plain
docker run --name my-container -p 8080:80 -d nginx 
# 用镜像名称为imageName的镜像 生成容器（my-container） 并且 将外层8000端口与容器内80端口相映射
docker run -itd -p 8000:80 --name my-container imageName
```

| 参数 | 含义 | 说明 | 记忆技巧 |
| --- | --- | --- | --- |
| `-i` | 交互模式（interactive） | 保持标准输入流打开，支持交互操作 | i = input（输入） |
| `-t` | 伪终端（tty） | 分配伪终端，使输出格式化，支持命令行交互 | t = terminal（终端） |
| `-d` | 后台运行（detached） | 容器在后台运行，不占用当前终端<br/><font style="color:#DF2A3F;">如果你没有加 </font>`<font style="color:#DF2A3F;">-d</font>`<font style="color:#DF2A3F;">，容器会占据终端，按下 Ctrl+C 会停止容器。</font> | d = detached（分离） |
| `-p 主机端口:容器端口` | 端口映射 | 将宿主机端口映射到容器内部端口，方便访问容器服务 | p = port（端口） |
| -v | 挂在文件 | **<font style="color:rgb(68, 114, 196);background-color:rgb(238, 240, 244);">-v 挂载文件，格式为：宿主机绝对路径目录:容器内目录，</font>** |  |


### 查看容器
```plain
docker ps  # 查看当前运行的容器
docker ps -a #查看所有容器
```

### 进入容器
```plain
docker exec -it [contianer-name or id] bash or sh
```

docker exec -it [contianer-name or id] bash or sh

### 退出容器
```plain
exit
```

### 暂停与恢复容器
```plain
docker pause my-container
docker unpause my-container


docker stop my-container
docker start my-container
```

### 删除容器
```plain
docker rm my-container
```

## DockerFile
**<font style="color:rgb(40, 40, 40);">Dockerfile</font>**<font style="color:rgb(40, 40, 40);">是用来构建Docker镜像的文本文件，是由一条条构建镜像所需的指令和参数构成的脚本。</font>

**<font style="color:rgb(40, 40, 40);">构建三步骤：</font>**

1. <font style="color:rgb(40, 40, 40);">编写Dockerfile文件</font>
2. <font style="color:rgb(40, 40, 40);">docker build命令构建镜像</font>
3. <font style="color:rgb(40, 40, 40);">docker run依镜像运行容器实例</font>

```plain
# 构建镜像 （需要在Dockerfile同级目录下构建）
docker build -t create-react-web .

# 说明（-t：设置 镜像的名字及tag）（最后的. 为当前目录）
```

```plain
WORKDIR /app
指定在创建容器后，终端默认登陆的进来工作目录，一个落脚点

RUN
容器构建时需要运行的命令
两种格式
 
shell格式（1）
RUN yum -y install vim

COPY <源路径> <目标路径>
```



## docker compose yaml
编写yaml文件  进入yaml文件同级目录 

```plain
version: "3.9"

services:

  # ==============================
  # Go 服务
  # ==============================
  account-server:
    build:
      context: ../        # Dockerfile 构建上下文
      dockerfile: Dockerfile
    container_name: account-server
    restart: always

    ports:
      - "8080:8080"

    environment:
      DB_HOST: mysql
      DB_PORT: 3306
      REDIS_HOST: redis
      REDIS_PORT: 6379

    volumes:
      # 挂载日志目录（不要用 .）
      - ../logs/account:/app/logs

    depends_on:
      - mysql
      - redis

    networks:
      - backend-net


  # ==============================
  # MySQL
  # ==============================
  mysql:
    image: mysql:8.0
    container_name: mysql-server
    restart: always

    ports:
      - "3306:3306"

    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: account
      MYSQL_USER: account_user
      MYSQL_PASSWORD: account_pass

    volumes:
      # 数据持久化
      - ../data/mysql:/var/lib/mysql

      # 初始化SQL
      - ../deploy/mysql/init:/docker-entrypoint-initdb.d

    command: >
      --default-authentication-plugin=mysql_native_password
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci

    networks:
      - backend-net


  # ==============================
  # Redis
  # ==============================
  redis:
    image: redis:7
    container_name: redis-server
    restart: always

    ports:
      - "6379:6379"

    volumes:
      - ../data/redis:/data

    command: redis-server --appendonly yes

    networks:
      - backend-net


  # ==============================
  # Nginx
  # ==============================
  nginx:
    image: nginx:latest
    container_name: nginx-server
    restart: always

    ports:
      - "80:80"
      - "443:443"

    volumes:
      # nginx配置
      - ../deploy/nginx/nginx.conf:/etc/nginx/nginx.conf

      # 静态文件
      - ../static:/usr/share/nginx/html

      # nginx日志
      - ../logs/nginx:/var/log/nginx

    depends_on:
      - account-server

    networks:
      - backend-net


# ==============================
# 网络
# ==============================
networks:
  backend-net:
    driver: bridge
```

### 启动和关闭
```bash
docker compose up        # 启动并在前台输出日志
docker compose up -d     # 启动并在后台运行（常用）
docker compose start     # 启动已经创建过的容器（不会重新创建）
```

```bash
docker compose stop      # 停止容器但不删除
docker compose down      # 停止并删除容器、网络、挂载的卷（完整清理）
docker compose restart   # 重启容器
```

