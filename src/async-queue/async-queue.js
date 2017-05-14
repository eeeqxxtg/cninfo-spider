// 异步队列 [fn1,fn2,fn3...]
// 队列里的任务依次执行：fn1完成之后执行fn2,fn2执行完成之后执行fn3...

class AsyncQueue {
    constructor(config) {
        //传入的配置参数 
        //每tick 毫秒 轮询一次队列,执行一个任务 不要传0！！！
        this.tick = (typeof config.tick) == 'undefined' ? 0 : config.tick;
        //每次连续执行numEverytime个任务，然后休息
        this.numEveryTime = config.numEveryTime || 100;
        //休息rest 毫秒
        this.rest = (typeof config.rest) == 'undefined' ? 30000 : config.rest;
        //整个任务队列完成后的回调函数
        this.finalFn = config.finalFn;
        //tick, numEveryTime, rest, finalFn

        //计时器
        this.timer = null;
        //任务队列执行计数器，数到numEveryTime之后又从0开始 
        this.number = 0;
        //任务等待标记,如果有异步任务正在执行，别的任务需要等待
        this.wait = false;
        //任务队列开始休息的时间
        this.startRest = null;
        //任务队列
        this.queue = [];
        //每个异步任务执行结束后返回的结果 res = err/data; [{result:res1},{result:res2}...]
        this.results = [];

        //启动异步队列
        this.boot();

    }
    //静态方法 判断一个值是不是在一个数组里
    static exist(arr, v) {
        let i = arr.length;
        while (i--) {
            if (arr[i] === v) {
                return true;
            }
        }
        return false;
    }
    //将异步操作序列化
    serialize(asyncFn) {
        return (...rest) => {
            //最后一个参数如果是function就当做callback
            let callback = null;
            if (typeof rest[rest.length - 1] == 'function') {
                callback = rest.pop();
            }
            let args = rest;

            this.queue.push((thenFn) => {
                //告诉别的任务排队等待
                this.wait = true;
                //要求异步任务必须有回调函数
                args = args.map((v, k) => {
                    //这里是个阴谋，如果参数是某个异步任务的返回值，那么这个返回值必然是个对象，这个对象的result才是真正的返回值
                    //利用了对象实际就是指针的特性，通过回调改变对象的属性，来拿到异步执行结果
                    if (AsyncQueue.exist(this.results, v)) {
                        return v.result;
                    } else {
                        return v;
                    }
                });
                //执行异步任务
                asyncFn(...args, (err, data) => {
                    let res = null;
                    if (err) {
                        res = err;
                    } else {
                        res = data;
                    }
                    //将异步任务的执行结果保存到results中
                    this.results.some((v, k) => {
                        //从前往后遍历results如果是空对象，就给它添加result属性，跳出遍历
                        if (JSON.stringify(v) === '{"err":"你要不同步使用异步任务的结果，我们还是好朋友"}') {
                            v.result = res;

                            for (let sk in this.$scope) {
                                if (this.$scope[sk] === v) {
                                    this.$scope[sk] = res;
                                    console.log(this.$scope[sk]);
                                    break;
                                }
                            }
                            return true;
                        }
                    });

                    //执行回调函数
                    callback && callback(res);
                    //最后执行这个钩子函数
                    thenFn && thenFn();
                    //我已经完成，后面的不需要等待了
                    this.wait = false;

                });
            });
            this.results.push({
                err: '你要不同步使用异步任务的结果，我们还是好朋友'
            });
            return this.results[this.queue.length - 1];
        }
    }

    //启动异步队列
    boot() {
        //setInterval 监视
        clearInterval(this.timer);
        this.timer = setInterval(() => {

            //上一个异步任务完成了，不需要等待了，才能进来
            if (!this.wait) {
                //如果还有任务排队
                if (this.queue.length) {
                    if (!this.startRest) { //异步队列还没有开始休息
                        //下一个异步任务出队
                        this.queue.shift()(() => {
                            if (this.startRest) {
                                console.log(`\r\n休息，休息${(this.rest/1000)}秒...\r\n`);
                            }
                        });
                        //计数器+1
                        this.number++;
                        //异步任务执行任务数达到this.numEveryTime了，就开始掐表休息，任务计数器清0
                        if (this.number === this.numEveryTime) {
                            this.startRest = new Date();
                            this.number = 0;
                        }
                    } else { //异步队列正在休息
                        //如果休息时间足够了，就停止休息
                        if ((new Date() - this.startRest) > this.rest) {
                            this.startRest = null;
                        }
                    }
                } else { //异步队列空了，关闭定时器，执行回调函数
                    //关闭计时器
                    clearInterval(this.timer);
                    //整个异步队列完成后的回调函数
                    this.finalFn && this.finalFn(this.$scope);
                }
            }
        }, this.tick);
    }
}

module.exports = (...rest) => {
    if (rest.length === 1) {
        return new AsyncQueue(rest[0]);
    } else if (rest.length === 3) {
        let config = {};
        //先拿到回调函数 finalFn，优先找第三个参数，没有才去1.x版本里的第一个参数里找
        if (typeof rest[2] == 'function') {
            config.finalFn = rest[2];
        } else if (rest[0].finalFn) {
            config.finalFn = rest[0].finalFn;
        }
        //删除finalFn
        //拷贝其他配置参数
        delete rest[0].finalFn;
        ['tick', 'numEveryTime', 'rest'].forEach((v, k) => {
            if (rest[0][v]) {
                config[v] = rest[0][v];
                delete rest[0][v];
            }
        });
        console.log(config);
        const aq = new AsyncQueue(config);

        let scope = {};
        //将异步任务绑定给scope
        for (let k in rest[0]) {
            scope[k] = aq.serialize(rest[0][k]);
        }

        //执行rest[1]
        rest[1](scope);

    }
};