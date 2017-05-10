# cninfo-spider
一只微小的爬虫，主要用于抓取[巨潮资讯（http://www.cninfo.com.cn）](http://www.cninfo.com.cn)上的证券信息。

+ 抓取中国（A股和港股）所有的股票代码和股票名称，如：000001 平安银行
+ 抓取中国所有的基金代码和名称，如：150008 瑞和小康
+ 抓取中国所有的债券代码和名称，如：100213 国债0213
+ 抓取以上所有的证券名称的拼音简写，如：000001-平安银行-payh
  
## usage  
使用起来非常简单。  

    npm install
    cd "cninfo-spider"
    node .
data文件夹里已经存放了现成的数据，运行起来默认只会往data里添加最新的更新数据，而不是更新所有的数据。如果你不愿意使用data里面的数据，而想要重新抓取最新数据，只需把index文件里的  

    cnspider.repair();
  
注释掉，改成：  

    cnspider.run();

然后重新node . 就可以了。    

不过这样做需要一点时间，毕竟要抓取5000+股票、6000+基金、7000+债券的拼音首字母。这需要发送（5000+6000+7000）+ = 13000+ 次http请求。可能大概需要2个多小时的时间。  
