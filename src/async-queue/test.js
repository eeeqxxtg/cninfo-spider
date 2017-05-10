const fs = require('fs');
const path = require('path');
//引入 async-queue.js
const Aq = require('./async-queue.js');

//配置 异步队列
const aq = Aq({
    //每1ms访问一次异步队列
    tick: 1,
    //连续执行3次 就休息500ms
    numEveryTime: 3,
    rest: 500,
    //整个异步队列执行完毕之后的回调函数
    finalFn: () => {
        console.log('异步队列完成');
    }
});

//这里有一个异步任务
const getContent = (file, callback) => {
    fs.readFile(file, 'utf8', (err, data) => {
        callback && callback(data);
    });
};

//调用aq的serialize方法将异步任务序列化，序列化之后就可以顺序执行
const getContentSerial = aq.serialize(getContent);

//一个测试文件
const file = path.join(__dirname, './test.html');


// ['第1', '第2', '第3', '第4', '第5', '第6', '第7', '第8', '第9', '第10'].forEach((v, k) => {
//     getContentSerial(file, (data) => {
//         console.log(data.length);//测试文件的长度 3668
//         console.log(v);
//     });
// });
[].forEach((v, k) => {
    getContentSerial(file, (data) => {
        console.log(data.length);//测试文件的长度 3668
        console.log(v);
    });
});
//按照顺序依次输出 '第1', '第2', '第3', '第4', '第5', '第6', '第7', '第8', '第9', '第10'


//作为对比，没有序列化的异步任务不会严格按照顺序执行
// ['第1', '第2', '第3', '第4', '第5', '第6', '第7', '第8', '第9', '第10'].forEach((v, k) => {
//     getContent(file, (data) => {
//         console.log(data.length);//测试文件的长度 2205
//         console.log(v);
//     });
// });
//会输出'第1', '第2', '第3', '第4', '第5', '第6', '第7', '第8', '第9', '第10'
//但是顺序并不能保证是严格的依次输出