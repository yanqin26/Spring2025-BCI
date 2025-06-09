    // 基础URL配置，定义后端API的基础URL
    const BASE_URL = 'http://localhost:3000';
    
    // 工具函数，时间格式化函数
    function formatTime(str) {
        if (!str) return '';// 空值检查
        const d = new Date(str);// 创建Date对象
        return d.toLocaleString('zh-CN', {
            year: 'numeric',// 完整年份，以下是两位数的设置
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    //图片路径构建函数
    function buildImagePath(imgPath) {
        if (!imgPath) return '';//// 空值检查
         // 如果是完整URL则直接使用，否则拼接基础URL
        return imgPath.startsWith('http') ? imgPath : `${BASE_URL}${imgPath}`;
    }
    
    // 显示加载错误函数
    function showError(message) {
        const errorDiv = document.createElement('div');// 设置错误消息样式类
        errorDiv.className = 'error-msg';
        // 使用Font Awesome图标和错误消息
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            ${message}
        `;
        
        dataList.innerHTML = '';// 清空当前列表
        dataList.appendChild(errorDiv);// 加载错误消息
    }

    // 渲染数据列表函数
    async function renderDataList() {
        try {
            const res = await axios.get(`${BASE_URL}/api/data`); // 从API获取数据
            const dataArr = res.data;
            console.log(dataArr);// 调试输出
            
            if (!Array.isArray(dataArr) || dataArr.length === 0) {// 空数据检查
                showError('没有找到数据，数据库可能为空');
                return;
            }
            
            dataList.innerHTML = '';// 清空列表
            
            // 使用延迟动画效果渲染每个卡片
            dataArr.forEach((item, index) => {
                setTimeout(() => {
                    renderDataCard(item);// 渲染单个卡片
                    
                    // 更新页脚的最新更新时间，如果是第一条数据，更新页脚时间
                    if(index === 0) {
                        document.getElementById('updateTime').textContent = formatTime(new Date());
                    }
                }, index * 150);// 每个卡片延迟150ms渲染
            });
        } catch (err) {
            console.error('加载数据时出错:', err);// 控制台错误日志
            // 显示详细的错误消息
            showError('数据加载失败：' + 
                     (err.response ? err.response.data.message || '服务器错误' : '网络连接失败'));
        }
    }
    
    // 渲染单个数据卡片函数
    function renderDataCard(item) {
        const card = document.createElement('div');// 卡片样式类
        card.className = 'data-card';
        
        // 构建图片HTML
        let imagesHTML = '';
        if (item.images && item.images.length > 0) {
            imagesHTML = '<div class="data-images">';
            item.images.forEach(img => {
                const imgUrl = buildImagePath(img);
                 // 创建可点击放大的图片链接
                imagesHTML += `<a href="${imgUrl}" target="_blank"><img src="${imgUrl}" alt="实验数据图像"></a>`;
            });
            imagesHTML += '</div>';
        }
        // 卡片HTML结构
        card.innerHTML = `
            <div class="data-header">
                <h3 class="data-title">${item.title}</h3>
                <div class="data-time">
                    <i class="fas fa-clock"></i>
                    创建时间：${formatTime(item.created_at)}
                </div>
            </div>
            <div class="data-content">
                <p class="data-desc">${item.description || '该数据集未添加详细描述。脑机接口(BCI)系统利用脑电信号解码人的运动意图,从而控制外部设备或实现运动功能重建。'}</p>
                ${imagesHTML}
            </div>
        `;
        dataList.appendChild(card);// 添加到列表
    }

    // 页面初始化
    document.addEventListener('DOMContentLoaded', () => {
        renderDataList();// 初始渲染数据
        
        // 设置动态更新时间，每秒更新页脚时间
        setInterval(() => {
            document.getElementById('updateTime').textContent = formatTime(new Date());
        }, 1000);
    });