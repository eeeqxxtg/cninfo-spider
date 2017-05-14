const fs = require('fs');
const path = require('path');
//引入 async-queue.js
const Aq = require('./async-queue.js');


//这里有一个异步任务
const getContent = (file, callback) => {
    fs.readFile(file, 'utf8', (err, data) => {
        callback && callback(err, 'ok');
    });
};


//一个测试文件
const file = path.join(__dirname, './test.html');


Aq({
    tick: 10,
    numEveryTime: 3,
    rest: 5000,
    finalFn: () => {
        console.log('finalFn')
    },
    f1: getContent,
    f2: (a, cb) => {
        setTimeout(() => {
            console.log(a);
            cb && cb();
        }, 100);
    }
}, (scope) => {
    scope.con = scope.f1(file);
    scope.f2('asd');
    console.log(scope.con);
    scope.f2(scope.con);
    scope.f2(scope.con);
    scope.f2(scope.con);
    scope.f2(scope.con);
    scope.f2(scope.con);
    scope.f2(scope.con);
    scope.f2(scope.con);
    scope.f2(scope.con);
    scope.f2(scope.con);
    scope.f2(scope.con);
    scope.f2(scope.con);
    console.log(scope);
}, (s) => {
    console.log('优先finalFn');
    console.log(s);
});
// console.log(global);

