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
        //任务队列查询了多少次
        this.number = 0;
        //任务等待标记
        this.wait = false;
        //任务队列
        this.queue = [];
    }
    //将异步操作序列化
    serialize(asyncFn) {
        return (...rest) => {
            //最后一个参数是callback
            let callback = null;
            if (typeof rest[rest.length - 1] == 'function') {
                callback = rest.pop();
            }
            const args = rest;
            this.queue.push(() => {
                this.wait = true;
                //要求异步任务必须有回调函数
                asyncFn(...args, (data) => {
                    callback && callback(data);
                    this.wait = false;
                    if (this.start && this.number === 0) {
                        console.log(`休息，休息${parseInt(this.rest/1000)}秒...`);
                    }
                });
            });

            //setInterval 监视
            clearInterval(this.timer);
            this.timer = setInterval(() => {
                if (this.queue.length) {
                    //上次任务完成了
                    if (!this.wait) {
                        //每次执行this.numEveryTime个任务， 然后休息 this.rest毫秒 
                        // if (this.number % (parseInt(this.rest / this.tick) + this.numEveryTime) < this.numEveryTime) {
                        //     this.queue.shift()();
                        // }
                        // this.number++;

                        if (this.start && (new Date() - this.start) > this.rest) {
                            this.start = null;
                        }
                        if (!this.start) {
                            this.queue.shift()();
                            this.number++;
                        }
                        if (this.number && this.number % this.numEveryTime === 0) {
                            this.start = new Date();
                            this.number = 0;
                        }
                    }
                } else {
                    //最后一次任务完成了
                    if (!this.wait) {
                        //关闭计时器
                        clearInterval(this.timer);
                        //回调函数
                        this.finalFn && this.finalFn();
                    }
                }
            }, this.tick);
        }

    }
}

module.exports = (config) => {
    return new AsyncQueue(config);
};