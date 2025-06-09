const BASE_URL = 'http://localhost:3000';// 定义基础API地址
    function getToken() { return localStorage.getItem('token'); }// 从本地存储获取token
    // 格式化时间显示
    function formatTime(str) { if (!str) return ''; const d = new Date(str); return d.toLocaleString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
    // 构建完整的图片路径
    function buildImagePath(imgPath) { if (!imgPath) return ''; return imgPath.startsWith('http') ? imgPath : `${BASE_URL}${imgPath}`; }
    // 获取DOM元素
    const logoutBtn = document.getElementById('logoutBtn');// 退出登录按钮
    const showAddFormBtn = document.getElementById('showAddFormBtn');// 显示添加表单按钮
    const addForm = document.getElementById('addForm');// 添加表单
    const cancelAddBtn = document.getElementById('cancelAddBtn');// 取消添加按钮
    const addTitle = document.getElementById('addTitle');// 添加标题输入框
    const addDesc = document.getElementById('addDesc');// 添加描述输入框
    const addImages = document.getElementById('addImages');// 添加图片文件选择
    const addError = document.getElementById('addError');// 添加错误提示
    const addSuccess = document.getElementById('addSuccess');// 添加成功提示
    const dataList = document.getElementById('dataList');// 数据列表容器

    // 1.“退出登录”按钮
    logoutBtn.onclick = function() {
        localStorage.removeItem('token');// 移除token
        window.location.href = 'login.html';//返回登录页
    };

    // 2.“添加数据”按钮，点击此按钮会显示添加数据的表单，并隐藏自身按钮
    showAddFormBtn.onclick = function() {
        addForm.style.display = '';// 显示表单
        showAddFormBtn.style.display = 'none';//隐藏显示按钮
        addError.style.display = 'none';//隐藏错误提示
        addSuccess.style.display = 'none';// 隐藏成功提示
        addTitle.value = '';// 清空标题
        addDesc.value = '';//清空描述
        addImages.value = '';//清空图片
    };

    // 3."添加数据”的“取消按钮”，点击此按钮会隐藏添加数据的表单，并显示添加表单的按钮
    cancelAddBtn.onclick = function() {
        addForm.style.display = 'none';// 隐藏表单
        showAddFormBtn.style.display = '';// 显示添加按钮
    };
    // 4.“添加数据”的“提交按钮”
    addForm.onsubmit = async function(e) {
        e.preventDefault();// 阻止默认表单提交，要先登录
        addError.style.display = 'none';//隐藏错误提示
        addSuccess.style.display = 'none';// 隐藏成功提示
        const title = addTitle.value.trim(); // 获取标题
        const description = addDesc.value.trim();//获取描述
        const files = addImages.files;// 获取选择的文件
        if (!title) {// 验证标题不能为空
            addError.textContent = '标题不能为空';
            addError.style.display = 'block';
            return;
        } 
        // 创建FormData对象用于文件上传
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        // 添加所有选择的图片文件
        for (let i = 0; i < files.length; i++) {
            formData.append('images', files[i]);
        }
        try {
            await axios.post(`${BASE_URL}/api/data`, formData, {
                headers: {
                    'Authorization': 'Bearer ' + getToken(),//认证头
                    'Content-Type': 'multipart/form-data'// 文件上传类型
                }
            });
            // 添加成功处理
            addSuccess.textContent = '添加成功';
            addSuccess.style.display = 'block';
            setTimeout(() => {// 1.2秒后隐藏表单并刷新列表
                addForm.style.display = 'none';
                showAddFormBtn.style.display = '';
                renderDataList();
            }, 1200);
        } catch (err) {// 错误处理
            addError.textContent = (err.response && err.response.data && err.response.data.message) ? err.response.data.message : '添加失败';
            addError.style.display = 'block';
        }
    };

    // 渲染数据列表
    async function renderDataList() {
        // 显示加载中状态
        dataList.innerHTML = '<div style="text-align:center;color:#888;">加载中...</div>';
        try { 
            // 获取数据
            const res = await axios.get(`${BASE_URL}/api/data`);
            const dataArr = res.data;
            // 检查数据是否为空
            if (!Array.isArray(dataArr) || dataArr.length === 0) {
                dataList.innerHTML = '<div style="text-align:center;color:#888;">暂无数据</div>';
                return;
            }
            dataList.innerHTML = '';// 清空列表
            dataArr.forEach(item => {// 遍历数据创建卡片
                const card = document.createElement('div');
                card.className = 'data-card';
                // 卡片HTML内容
                card.innerHTML = `
                    <div class="data-header">
                        <h3 class="data-title">${item.title}</h3>
                        <div class="data-time"><i class="fas fa-clock"></i> 创建时间：${formatTime(item.created_at)}</div>
                    </div>
                    <div class="data-content">
                        <p class="data-desc">${item.description || '该数据集未添加详细描述。'}</p>
                        ${item.images && item.images.length > 0 ? `<div class="data-images">${item.images.map(img => `<a href="${buildImagePath(img)}" target="_blank"><img src="${buildImagePath(img)}" alt="图片"></a>`).join('')}</div>` : ''}
                        <div class="card-actions">
                            <button class="action-btn" onclick="editData(${item.id})"><i class="fas fa-edit"></i> 编辑</button>
                            <button class="action-btn" onclick="deleteData(${item.id})"><i class="fas fa-trash"></i> 删除</button>
                        </div>
                    </div>
                `;
                dataList.appendChild(card);// 添加到列表
            });
        } catch (err) {
            // 加载失败处理
            dataList.innerHTML = '<div style="text-align:center;color:#d32f2f;">加载失败</div>';
        }
    }


    //5.“删除”数据按钮(全局函数)
    window.deleteData = async function(id) {
        if (!confirm('确定要删除这条数据吗？')) return;// 确认对话框
        try {//下面这行代码发送HTTP DELETE，请求到后端API，携带请求路径：/api/data/123和请求头
            await axios.delete(`${BASE_URL}/api/data/` + id, {
                headers: { 'Authorization': 'Bearer ' + getToken() }
            });
            renderDataList();// 刷新列表
        } catch (err) {
            alert('删除失败');
        }
    }


    // 6，“编辑”按钮(全局函数)
    window.editData = function(id) {
        // 先移除已有编辑表单
        const oldForm = document.getElementById('editForm_' + id);
        if (oldForm) oldForm.remove();
        // 获取数据
        axios.get(`${BASE_URL}/api/data`).then(res => {
            const item = res.data.find(d => d.id === id);
            if (!item) return;
            // 创建编辑表单
            const form = document.createElement('form');
            form.className = 'edit-form';
            form.id = 'editForm_' + id;
            // 表单HTML内容
            form.innerHTML = `
                <div class="form-group">
                    <label>标题</label>
                    <input type="text" name="title" value="${item.title.replace(/"/g, '&quot;')}" required>
                </div>
                <div class="form-group">
                    <label>描述</label>
                    <textarea name="description">${item.description ? item.description.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>图片（可多选，留空则不变）</label>
                    <input type="file" name="images" multiple accept="image/*">
                </div>
                <div class="form-group">
                    <label>已上传图片</label>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        ${(item.images||[]).map(img => `<div style='position:relative;display:inline-block;'><a href='${buildImagePath(img)}' target='_blank'><img src='${buildImagePath(img)}' style='width:60px;height:60px;object-fit:cover;border-radius:3px;border:1px solid #e0e0e0;'></a><input type='checkbox' checked data-img='${img}' style='position:absolute;top:2px;right:2px;z-index:2;'></div>`).join('')}
                    </div>
                    <div style="color:#888;font-size:0.95em;">取消勾选将删除图片</div>
                </div>
                <div class="form-btns">
                    <button type="submit" class="form-btn">保存</button>
                    <button type="button" class="form-btn cancel">取消</button>
                </div>
                <div class="error-message" style="display:none;"></div>
                <div class="success-message" style="display:none;"></div>
            `;
            // 插入到数据列表顶部
            dataList.insertBefore(form, dataList.firstChild);


            // 7."编辑表单"的"取消按钮"
            form.querySelector('.cancel').onclick = function() { form.remove(); };

            // 8，"编辑表单"的"保存按钮"
            form.onsubmit = async function(e) {
                e.preventDefault();
                const errorMsg = form.querySelector('.error-message');
                const successMsg = form.querySelector('.success-message');
                errorMsg.style.display = 'none';
                successMsg.style.display = 'none';
                 // 获取表单值
                const title = form.title.value.trim();
                const description = form.description.value.trim();
                const images = form.images.files;
                // 处理保留图片
                const keepImages = Array.from(form.querySelectorAll('input[type=checkbox][data-img]')).filter(cb => cb.checked).map(cb => cb.getAttribute('data-img'));
                if (!title) {// 验证标题
                    errorMsg.textContent = '标题不能为空';
                    errorMsg.style.display = 'block';
                    return;
                }
                // 创建FormData
                const formData = new FormData();
                formData.append('title', title);
                formData.append('description', description);
                formData.append('keepImages', JSON.stringify(keepImages));
                for (let i = 0; i < images.length; i++) {// 添加新图片
                    formData.append('images', images[i]);
                }
                try {
                    await axios.put(`${BASE_URL}/api/data/` + id, formData, {
                        headers: {
                            'Authorization': 'Bearer ' + getToken(),
                            'Content-Type': 'multipart/form-data'
                        }
                    });
                    // 成功处理
                    successMsg.textContent = '保存成功';
                    successMsg.style.display = 'block';
                    setTimeout(() => {// 1.2秒后移除表单并刷新列表
                        form.remove();
                        renderDataList();
                    }, 1200);
                } catch (err) {// 错误处理
                    errorMsg.textContent = (err.response && err.response.data && err.response.data.message) ? err.response.data.message : '保存失败';
                    errorMsg.style.display = 'block';
                }
            };

        });
    }
    //页面初始化时渲染数据列表
    renderDataList();