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
    rest: 5000,
    //整个异步队列执行完毕之后的回调函数
    finalFn: () => {
        console.log('\r\n异步队列完成');
    }
});

//这里有一个异步任务
const getContent = (file, callback) => {
    fs.readFile(file, 'utf8', (err, data) => {
        callback && callback(err, 'ok');
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

//如果数组为空，会直接调用finalFn
// [].forEach((v, k) => {
//     getContentSerial(file, (data) => {
//         console.log(data.length); //测试文件的长度 3668
//         console.log(v);
//     });
// });

//返回结果
//一个新的一步任务
const fn = (a, callback) => {
    setTimeout(() => {
        console.log(a);
        callback && callback();
    }, 0);
};

const fnSerial = aq.serialize(fn);

let res = getContentSerial(file);
console.log(res);
fnSerial(res);
// fnSerial(res);

['第1', '第2', '第3', '第4', '第5', '第6', '第7', '第8', '第9', '第10'].forEach((v, k) => {
    getContentSerial(file, (data) => {
        console.log(data.length); //测试文件的长度 2205
        console.log(v);
    });
});




//新版本的API
// aq({
//     tick: 0,
//     numberEveryTime:100,
//     rest:1000;
//     fn1: () => {},//异步任务必须有回调，回调必须有两个参数（err,data）
//     fn2: () => {},
//     //...
//     cb:()=>{}//回调函数可以不用在最后声明，可以是异步操作，不需要调用
// }, () => {
//     fn1();//可以同步的方式不写callback，也允许使用callback,但是callback不能是异步操作，也没必要，异步操作完全可以包装一下放在异步队列里
//     [1,2,3].forEach((v)=>{
//         fn1(v);
//     });
//     let res1 = fn1(arg);
//     fn2(res1);
//     fn2();
//     cb();
// },cb);//或者将cb放在最后

// function fn(){
//     f11();
//     f22();
// }
// fn();//err
// (function(){
//     f11 = function(){
//         console.log('11');
//     }
//     f22 = function(){
//         console.log('22');
//     }
//     fn();
// })();
// function fn(){
//     f11();
//     f22();
// }
// const obj = {
//     f11: () => {
//         console.log('not11');
//     },
//     f22: () => {
//         console.log('not22')
//     }
// };
// for (let k in obj){
//     this[k] = ()=>{
//         console.log(k);
//     }
// }
// fn();