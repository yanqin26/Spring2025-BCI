//获取登录表单元素并添加提交事件监听器
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();// 阻止表单默认提交行为(防止页面刷新)
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');// 获取错误消息显示元素
    errorMsg.style.display = 'none';// 隐藏错误消息(每次提交时先清除之前的错误)
    try {
        // 使用axios发送POST请求到登录API端点
        const res = await axios.post('http://localhost:3000/api/login', { username, password });
        const data = res.data;// 获取响应数据
        if (data.success) {
            localStorage.setItem('token', data.token);//登录成功后1. 将token保存到本地存储
            window.location.href = 'admin.html';// 2. 跳转到admin.html页面
        } else {
            errorMsg.textContent = data.message || '登录失败';// 1. 显示服务器返回的错误消息，如果没有则显示默认消息
            errorMsg.style.display = 'block'; // 2. 显示错误消息元素
        }
    } catch (err) {
        // 处理请求过程中发生的错误:
        // 1. 检查是否有响应数据中的错误消息，否则使用默认网络错误消息
        errorMsg.textContent = (err.response && err.response.data && err.response.data.message) ? err.response.data.message : '网络错误，请稍后重试';
        errorMsg.style.display = 'block';
    }
});