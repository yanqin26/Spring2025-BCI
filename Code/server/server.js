require('dotenv').config();// 加载环境变量配置
// 引入所需模块
const express = require('express');// Express框架
const cors = require('cors');// 跨域支持
const mysql = require('mysql2/promise');// MySQL数据库驱动(Promise版本)
const multer = require('multer');// 文件上传处理
const path = require('path');//路径处理
const bcrypt = require('bcryptjs');// 密码加密
const jwt = require('jsonwebtoken');// JWT认证

const app = express();// 创建Express应用实例
const port = process.env.SERVER_PORT;// 从环境变量获取服务器端口

// 中间件配置
app.use(cors());// 启用跨域支持
app.use(express.json());// 解析JSON请求体
app.use('/uploads', express.static('uploads'));// 设置静态文件目录(用于图片访问)

// 1.数据库连接配置
const pool = mysql.createPool({
    host: process.env.DB_HOST,// 数据库主机地址
    user: process.env.DB_USER,// 数据库用户名
    password: process.env.DB_PASSWORD,// 数据库密码
    waitForConnections: true,// 等待连接
    connectionLimit: 10,// 连接池大小
    queueLimit: 0//无排队限制
});

// 文件上传配置
const storage = multer.diskStorage({
     // 设置文件存储目录uploads/
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    // 设置文件名(时间戳+原始扩展名)
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
// 创建multer上传实例
const upload = multer({ storage: storage });

// 2.初始化数据库函数，创建数据库和表
async function initializeDatabase() {
    try {// 从连接池获取连接
        const connection = await pool.getConnection();
        // 创建数据库，若不存在
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
        await connection.query(`USE ${process.env.DB_NAME}`); // 使用该数据库

        // 创建用户表users
        //自增主键，唯一用户名，加密密码，创建时间
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 创建数据表data
        //自增主键，数据标题非空，描述是TEXT文本类型，创建时间
        await connection.query(`
            CREATE TABLE IF NOT EXISTS data (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 创建图片表（关联数据表)images
        //自增主键，关联的数据ID，图片路径，创建时间，外键约束（级联删除）
        await connection.query(`
            CREATE TABLE IF NOT EXISTS images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                data_id INT,
                path VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (data_id) REFERENCES data(id) ON DELETE CASCADE
            )
        `);

        // 检查默认用户是否存在
        const [users] = await connection.query('SELECT * FROM users WHERE username = ?', [process.env.DEFAULT_USERNAME]);
        // 如果不存在则创建默认用户
        if (users.length === 0) {
            // 密码加密(10位盐值)
            const hashedPassword = await bcrypt.hash(process.env.DEFAULT_PASSWORD, 10);
            await connection.query('INSERT INTO users (username, password) VALUES (?, ?)', 
                [process.env.DEFAULT_USERNAME, hashedPassword]);
            console.log('默认用户创建成功');
        }

    // 释放连接回连接池,释放数据库连接并处理初始化过程中可能出现的异常
        connection.release();
        console.log('数据库初始化成功');
    } catch (error) {
        console.error("请检查数据库是否启动或者配置文件是否修改.")
        console.error('数据库初始化错误:', error);
    }
}

// JWT身份验证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization']; // 从请求头获取Authorization字段
    const token = authHeader && authHeader.split(' ')[1];// 提取Bearer token
    if (!token) return res.sendStatus(401); // 无token返回401未授权
   //验证token
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);// token无效返回403禁止访问
        req.user = user;// 将用户信息附加到请求对象
        next();//继续后续处理
    });
};

// 1.“登录”接口，将用户名和密码发到服务器的/api/login接口进行验证
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;// 从请求体获取用户名和密码
         // 查询用户
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        // 如果用户不存在
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: '用户不存在' });
        }

        const user = users[0];// 获取第一条用户记录
        const validPassword = await bcrypt.compare(password, user.password);// 验证密码

        if (!validPassword) {// 密码错误
            return res.status(401).json({ success: false, message: '密码错误' });
        }

        // 生成JWT token
        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
        res.json({ success: true, token });// 返回成功响应
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 6."编辑"按钮接口
app.get('/api/data', async (req, res) => {
    try {
        // 添加数据库连接检查
        const connection = await pool.getConnection();
        try {// 查询数据及关联图片(按创建时间降序)
            const [data] = await connection.query(`
                SELECT d.*, GROUP_CONCAT(i.path) as images
                FROM data d
                LEFT JOIN images i ON d.id = i.data_id
                GROUP BY d.id
                ORDER BY d.created_at DESC
            `);
            // 格式化图片路径(添加/uploads前缀)
            const formattedData = data.map(item => ({
                ...item,
                images: item.images ? item.images.split(',').map(path => '/uploads/' + path) : []
            }));

            res.json(formattedData);// 返回格式化后的数据
        } catch (error) {
            console.error('数据库查询错误:', error);
            res.status(500).json({ 
                success: false, 
                message: '数据库查询失败',
                error: error.message 
            });
        } finally {
            connection.release(); // 释放连接
        }
    } catch (error) {
        console.error('数据库连接错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '数据库连接失败',
            error: error.message 
        });
    }
});

// 4."添加数据" - "提交"按钮接口
app.post('/api/data', authenticateToken, upload.array('images'), async (req, res) => {
    try {// 从请求体获取标题和描述
        const { title, description } = req.body;
        const files = req.files;// 获取上传的文件

        // 插入数据记录
        const [result] = await pool.query(
            'INSERT INTO data (title, description) VALUES (?, ?)',
            [title, description]
        );

        const dataId = result.insertId;// 获取新插入数据的ID

        if (files && files.length > 0) {// 如果有上传图片
            const imageValues = files.map(file => [dataId, file.filename]); // 准备图片记录值
            await pool.query(// 批量插入图片记录
                'INSERT INTO images (data_id, path) VALUES ?',
                [imageValues]
            );
        }

        res.json({ success: true, message: '数据添加成功' }); // 返回成功响应
    } catch (error) {
        console.error('添加数据错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 5."删除"按钮接口
app.delete('/api/data/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;// 获取要删除的数据ID
        await pool.query('DELETE FROM data WHERE id = ?', [id]);// 执行删除操作(级联删除关联图片)
        res.json({ success: true, message: '数据删除成功' });// 返回成功响应
    } catch (error) {
        console.error('删除数据错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 8.“编辑”-“保存按钮”接口
app.put('/api/data/:id', authenticateToken, upload.array('images'), async (req, res) => {
    try {
        const { id } = req.params;// 获取数据ID
        const { title, description, keepImages } = req.body;// 获取请求体数据
        const files = req.files;// 获取上传的文件

        // 更新基本信息
        await pool.query(
            'UPDATE data SET title = ?, description = ? WHERE id = ?',
            [title, description, id]
        );

        // 处理图片保留与删除
        let keepList = [];
        if (keepImages) {
            try {// 解析保留图片列表并移除/uploads前缀
                keepList = JSON.parse(keepImages).map(p => p.replace(/^\/uploads\//, ''));
            } catch (e) {
                keepList = [];
            }
        }
        // console.log('keepImages前端传递:', keepImages);
        // console.log('keepList(去除/uploads/):', keepList);

        // 查询原有图片
        const [oldImages] = await pool.query('SELECT path FROM images WHERE data_id = ?', [id]);
        const oldPaths = oldImages.map(img => img.path);
        // console.log('数据库原有图片:', oldPaths);

        // 找出需要删除的图片（不在保留列表中的）
        const toDelete = oldPaths.filter(path => !keepList.includes(path));
        // console.log('需要删除的图片:', toDelete);

        // 删除数据库和磁盘文件
        if (toDelete.length > 0) {
             // 从数据库删除记录
            await pool.query('DELETE FROM images WHERE data_id = ? AND path IN (?)', [id, toDelete]);
            const fs = require('fs');
            const pathModule = require('path');
            // 物理删除文件
            toDelete.forEach(path => {
                const filePath = pathModule.join(__dirname, '..', 'uploads', path);
                fs.unlink(filePath, err => { if (err) console.error('物理删除图片失败:', filePath, err); });
            });
        }

        // 如果有新图片，添加新图片记录
        if (files && files.length > 0) {
            const imageValues = files.map(file => [id, file.filename]);
            await pool.query(
                'INSERT INTO images (data_id, path) VALUES ?',
                [imageValues]
            );
        }

        // 获取更新后的完整数据
        const [updatedData] = await pool.query(`
            SELECT d.*, GROUP_CONCAT(i.path) as images
            FROM data d
            LEFT JOIN images i ON d.id = i.data_id
            WHERE d.id = ?
            GROUP BY d.id
        `, [id]);

        // 格式化图片路径
        const formattedData = {
            ...updatedData[0],
            images: updatedData[0].images ? updatedData[0].images.split(',').map(path => '/uploads/' + path) : []
        };

        // 返回更新后的数据
        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error('更新数据错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 创建上传目录
const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// 先初始化数据库后启动服务器
initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`服务启动成功,运行在\n http://localhost:${port}`);
    });
}); 