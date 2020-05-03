const path = require('path');
const Koa = require('koa');
const koaBody = require('koa-body');
const koaStatic = require('koa-static');
const app = new Koa();
app.use(koaStatic(path.join(__dirname, './static/')));
app.use(koaBody({
    multipart: true
}));
const router = require('koa-router')();
const conn = require('./conn');
const {
    saveImage,
    deleteImage,
    getDateTime
} = require('./functions');

// 管理员登录
router.post('/admin', async ctx => {
    let {
        adminName,
        adminPass
    } = ctx.request.body;
    let connection = await conn();
    let [rows] = await connection.execute('select admin_password from tb_admin where admin_name = ?', [adminName]);
    connection.end();
    let res = null;
    if (rows.length && rows[0].admin_password === adminPass) {
        res = {
            ok: 1
        };
    } else {
        res = {
            ok: 0
        };
    }
    ctx.body = res;
});
// ====================================================================================================================================

// 查询用户名是否被注册
router.get('/user', async ctx => {
    let user_name = ctx.query.name;
    let response = {
        ok: 0
    };
    let connection = await conn();
    let [res] = await connection.execute('select user_name from tb_user where user_name = ?', [user_name]);
    connection.end();
    if (res.length) response.ok = 1;
    ctx.body = response;
});
// 用户登录
router.post('/user', async ctx => {
    let {
        user_name,
        user_password
    } = ctx.request.body;
    let response = {
        ok: 0
    };
    let connection = await conn();
    let [res] = await connection.execute('select user_password from tb_user where user_name = ?', [user_name]);
    connection.end();
    if (res.length && res[0].user_password === user_password) response.ok = 1;
    ctx.body = response;
});
// 用户注册
router.post('/register', async ctx => {
    let {
        user_name,
        user_password
    } = ctx.request.body;
    let response = {
        ok: 0
    };
    let connection = await conn();
    let [res] = await connection.execute('insert into tb_user (user_name, user_password) values (?, ?)', [user_name, user_password]);
    connection.end();
    if (res.affectedRows) response.ok = 1;
    ctx.body = response;
});
// ====================================================================================================================================

// 获取商品接口 参数为商品id 不给参数默认获取全部商品
router.get('/goods', async ctx => {
    let {
        id
    } = ctx.query;
    let connection = await conn();
    let response = null;
    if (id) {
        // 有id 给一条数据
        let [res] = await connection.execute('select * from tb_goods where goods_id = ?', [parseInt(id)]);
        response = {
            ok: 1,
            ...res[0]
        };
    } else {
        // 没id 给全部数据
        let [res] = await connection.execute('select * from tb_goods');
        response = {
            ok: 1,
            arrData: res
        };
    }
    connection.end();
    ctx.body = response;
});
// 管理员新增商品
router.post('/addgoods', async ctx => {
    // 商品名 商品描述 价格
    let {
        name,
        description,
        price
    } = ctx.request.body;
    // 保存图片文件
    let imgName = saveImage(ctx.request.files.file);
    // 前端获取图片的地址
    let imgPath = 'api/images/' + imgName;
    let connection = await conn();
    let [res] = await connection.execute('insert into tb_goods (goods_name, goods_description, goods_price, goods_imgsrc) values (?, ?, ?, ?)', [name, description, price, imgPath]);
    connection.end();
    if (res.affectedRows) {
        ctx.body = {
            ok: 1
        };
    } else {
        ctx.body = {
            ok: 0,
            info: '插入新商品失败'
        };
    }
});
// 管理员修改商品接口
router.post('/editgoods', async ctx => {
    // 商品名 商品描述 价格
    let {
        goods_id,
        goods_name,
        goods_description,
        goods_price,
        isSale
    } = ctx.request.body;
    let on_sale = String(isSale) === 'true' ? 1 : 0;
    let connection = await conn();
    // 如果更新了图片
    if (ctx.request.files && ctx.request.files.file) {
        // 删除之前的图片
        let [res] = await connection.execute('select goods_imgsrc from tb_goods where goods_id = ?', [goods_id]);
        let oldImgSrc = res[0].goods_imgsrc.substring(4);
        deleteImage(oldImgSrc);
        let imgName = saveImage(ctx.request.files.file);
        let imgPath = 'api/images/' + imgName;
        let [ud_res] = await connection.execute('update tb_goods set goods_imgsrc = ? where goods_id = ?', [imgPath, goods_id]);
        if (ud_res.affectedRows) {
            console.log('更新图片成功');
        };
    }
    // 更新除了图片外其他的信息
    let [res] = await connection.execute('update tb_goods set goods_name = ?, goods_description = ?, goods_price = ?, on_sale = ? where goods_id = ?', [goods_name, goods_description, goods_price, on_sale, goods_id]);
    connection.end();
    if (res.affectedRows) {
        ctx.body = {
            ok: 1
        };
    } else {
        ctx.body = {
            ok: 0
        };
    }
});
// ====================================================================================================================================

// 获取用户收货信息
router.get('/receiver', async ctx => {
    // 接收参数为用户名
    let {
        name
    } = ctx.query;
    let response = {
        ok: 1
    };
    let connection = await conn();
    let [res] = await connection.execute('select id, receiver_name, receiver_address, receiver_phone, is_default from tb_receiver_info where user_name = ? and is_delete = 0', [name]);
    connection.end();
    let defaultAddress = null,
        otherAddress = null;
    if (res.length) {
        let defaultIndex = res.findIndex(item => item.is_default === 1);
        if (defaultIndex !== -1) defaultAddress = res.splice(defaultIndex, 1)[0];
        otherAddress = res;
    }
    response.addressData = {
        defaultAddress,
        otherAddress
    }
    ctx.body = response;
});
// 用户添加新的收货地址
router.post('/receiver', async ctx => {
    let {
        user_name,
        receiver_name,
        receiver_address,
        receiver_phone
    } = ctx.request.body;
    let is_default = 0;
    let response = {
        ok: 0
    };
    let connection = await conn();
    // 先找原来有没有默认地址
    let [res] = await connection.execute('select id from tb_receiver_info where user_name = ? and is_default = 1', [user_name]);
    if (!res.length) is_default = 1;
    // 如果没有，新增的这一条就是默认地址
    let [res1] = await connection.execute('insert into tb_receiver_info (user_name, receiver_name, receiver_address, receiver_phone, is_default) values (?, ?, ?, ?, ?)', [user_name, receiver_name, receiver_address, receiver_phone, is_default]);
    connection.end();
    if (res1.affectedRows) response.ok = 1;
    ctx.body = response;
});
// 用户更新默认收货地址
router.put('/receiver', async ctx => {
    let {
        id,
        user_name
    } = ctx.request.body;
    let response = {
        ok: 0
    };
    let connection = await conn();
    // 找到原来的默认地址
    let [res] = await connection.execute('select id from tb_receiver_info where user_name = ? and is_default = 1', [user_name]);
    let oldId = res[0].id;
    // 更改成普通地址
    let [res1] = await connection.execute('update tb_receiver_info set is_default = 0 where id = ?', [oldId]);
    // 将本次的改成默认地址
    let [res2] = await connection.execute('update tb_receiver_info set is_default = 1 where id = ?', [id]);
    connection.end();
    if (res1.affectedRows && res2.affectedRows) response.ok = 1;
    ctx.body = response;
});
// 用户删除一条收货地址
router.delete('/receiver', async ctx => {
    let id = ctx.query.id;
    let response = {
        ok: 0
    };
    let connection = await conn();
    let [res] = await connection.execute('update tb_receiver_info set is_delete = 1 where id = ?', [id]);
    connection.end();
    if (res.affectedRows) response.ok = 1;
    ctx.body = response;
});
// ====================================================================================================================================

// 用户查询自己的历史订单，不包括删除了的订单；管理员查看所有用户的历史订单（包括用户删除之后的）
router.get('/order', async ctx => {
    let user_name = ctx.query.name;
    let orderData = null,
        res = null;
    let connection = await conn();
    // 传了用户名就查此用户的数据，否则查所有用户数据
    if (user_name) {
        let arrResult = await connection.execute('select order_num, order_datetime, order_remark, is_handle from tb_order where user_name = ? && is_delete = 0', [user_name]);
        res = arrResult[0];
        if (res.length) {
            res = res.map(item => {
                return {
                    order_num: item.order_num,
                    order_datetime: getDateTime(item.order_datetime),
                    order_remark: item.order_remark,
                    is_handle: item.is_handle
                };
            });
            orderData = res.reverse();
        };
    } else {
        let arrResult = await connection.execute('select order_num, user_name, order_datetime, order_remark, is_handle from tb_order');
        res = arrResult[0];
        if (res.length) {
            res = res.map(item => {
                return {
                    order_num: item.order_num,
                    user_name: item.user_name,
                    order_datetime: getDateTime(item.order_datetime),
                    order_remark: item.order_remark,
                    is_handle: item.is_handle
                };
            });
            orderData = res;
        };
    }
    connection.end();
    ctx.body = {
        ok: 1,
        orderData
    };
});
// 用户查看订单详情，以及管理员查看订单详情
router.get('/orderdetail', async ctx => {
    let order_num = ctx.query.num;
    let delivery_num = null,
        receiver_address = "",
        receiver_name = "",
        receiver_phone = "";
    let goodsData = [];
    let connection = await conn();
    let [res] = await connection.execute('select a.goods_name, a.goods_price, b.goods_number from tb_goods a, tb_order_detail b where b.order_num = ? && b.goods_id = a.goods_id', [order_num]);
    if (res.length) goodsData = res;
    let [res1] = await connection.execute('select delivery_num from tb_order where order_num = ?', [order_num]);
    if (res1.length) delivery_num = res1[0].delivery_num;
    let [res2] = await connection.execute('select a.receiver_name, a.receiver_address, a.receiver_phone from tb_receiver_info a, tb_order b where b.order_num = ? && a.id = b.receiver_id', [order_num]);
    if (res2.length) {
        receiver_address = res2[0].receiver_address;
        receiver_name = res2[0].receiver_name;
        receiver_phone = res2[0].receiver_phone;
    }
    connection.end();
    ctx.body = {
        ok: 1,
        // 商品详情
        goodsData,
        // 物流单号
        delivery_num,
        // 用户下单时的收货信息
        receiver_address,
        receiver_name,
        receiver_phone
    }
});
// 用户下单，同时操作两个表 tb_order 和 tb_order_detail
router.post('/order', async ctx => {
    let {
        user_name,
        order_remark,
        receiver_id,
        arrCartData
    } = ctx.request.body;
    // 订单号用时间戳代替了
    let order_num = `${Date.now()}`;
    let order_datetime = getDateTime();
    let connection = await conn();
    // 插入订单
    let [res] = await connection.execute('insert into tb_order (order_num, user_name, order_remark, order_datetime, receiver_id) values (?, ?, ?, ?, ?)', [order_num, user_name, order_remark, order_datetime, receiver_id]);
    if (res.affectedRows) console.log('步骤一成功');
    // 插入详细商品
    let t = 0;
    for (let i = 0; i < arrCartData.length; i++) {
        let [res] = await connection.execute('insert into tb_order_detail (order_num, goods_id, goods_number) values (?, ?, ?)', [order_num, arrCartData[i].id, arrCartData[i].num]);
        if (res.affectedRows) t++;
    }
    if (t === arrCartData.length) console.log('步骤二成功');
    connection.end();
    ctx.body = {
        ok: 1
    };
});
// 管理员对订单添加物流单号，更新是否处理字段
router.patch('/order', async ctx => {
    let {
        order_num,
        delivery_num
    } = ctx.request.body;
    let response = { ok: 0 };
    let connection = await conn();
    let [res] = await connection.execute('update tb_order set delivery_num = ?, is_handle = 1 where order_num = ?', [delivery_num, order_num]);
    if (res.affectedRows) response.ok = 1;
    connection.end();
    ctx.body = response;
});
// 用户删除已经处理过的订单
router.delete('/order', async ctx => {
    let order_num = ctx.query.num;
    let response = { ok: 0 };
    let connection = await conn();
    let [res] = await connection.execute('update tb_order set is_delete = 1 where order_num = ?', [order_num]);
    if (res.affectedRows) response.ok = 1;
    connection.end();
    ctx.body = response;
});
router.get('*', ctx => ctx.body = { ok: 0, info: 'bad request' })
    .post('*', ctx => ctx.body = { ok: 0, info: 'bad request' })
    .put('*', ctx => ctx.body = { ok: 0, info: 'bad request' })
    .patch('*', ctx => ctx.body = { ok: 0, info: 'bad request' })
    .delete('*', ctx => ctx.body = { ok: 0, info: 'bad request' });
app.use(router.routes(), router.allowedMethods());
app.listen(3000, () => console.log('localhost:3000'));