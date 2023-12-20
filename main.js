const parser =  require('node-html-parser');
const getHTML = require('html-get')
const discord = require('discord.js');
const rp = require('request-promise');
const getIP = require('external-ip')();

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./rule34.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS `used_images` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `channel` VARCHAR(32), `image_id` INT)")
});

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min) ) + min;
  }

function AddIntervals(bot){
    bot.interval_GetContent_TIMER   = setInterval(async () => { bot.interval_ds_push(); }, getRndInteger(10000, 30000));
    bot.interval_PrepireUrls_TIMER  = setInterval(async () => { bot.interval_GetContent(); }, getRndInteger(30000, 60000));
    bot.interval_ds_push_TIMER      = setInterval(async () => { bot.interval_PrepireUrls(); }, getRndInteger(10000, 30000));
    
    bot.interval_output = setInterval(async () => { 
        WriteLine(bot.channel + ": " + "PU: " + bot.POST_URL.length + " UC: " + bot.URLS_CASHE.length + " U: " + bot.URLS.length + " UU: " + bot.URLS_USED.length);
     }, getRndInteger(15000, 30000));
}

function ClearIntervals(bot){
    clearInterval(bot.interval_GetContent_TIMER);
    clearInterval(bot.interval_PrepireUrls_TIMER);
    clearInterval(bot.interval_ds_push_TIMER);
    clearInterval(bot.interval_output);
}

function WriteLine(text){
    let currentdate = new Date(); 
    let datetime = currentdate.getDate() + "/"
                + (currentdate.getMonth()+1)  + "/" 
                + currentdate.getFullYear() + " "  
                + currentdate.getHours() + ":"  
                + currentdate.getMinutes() + ":" 
                + currentdate.getSeconds();
    console.log(datetime + ": " + text);
}

class HornyBOT {
    constructor(channel, tags) {
      this.channel = channel;
      this.tags = tags;

      this.POST_URL = [];
      this.URLS = [];
      this.URLS_USED = [];
      this.URLS_CASHE = [];

      this.interval_GetContent_TIMER = null;
      this.interval_PrepireUrls_TIMER = null;
      this.interval_ds_push_TIMER = null;
      this.interval_output = null;

      this.MAIN_URL = "https://rule34.xxx";
    }

    DB_Add_ID(channel, id){
        const stmt = db.prepare("INSERT INTO used_images VALUES (NULL, ?, ?)");
        stmt.run(channel, id);
        stmt.finalize();
    }

    async getPostsURLS(XXX, channel){
        await rp({
            uri:XXX,
            headers:{
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 OPR/78.0.4093.153"
            } 
        })
        .then((html) => {
            if(channel == null) return;
            var root = parser.parse(html);
    
            var s = root.querySelector('.image-list').childNodes;
            s.forEach(element => {
                let href = parser.parse(element.toString()).querySelector('a');
                if(href != null){
                    let id = href.getAttribute('id').replace(/[^+\d]/g, '')
                    href = href.getAttribute('href')
                    let notExist = true;
                    for(let n = 0; n < this.POST_URL.length; n++)
                        if(this.POST_URL[n][1] == id && this.POST_URL[n][2] == channel) notExist = false;
                    if(notExist){
                        this.POST_URL.push([href, id, channel]);
                        //console.log(id + "=> " + href);
                    }
                }
            });
    
            //PrepireUrls()   
        })
        .catch((error) => {
            console.error('ERROR:getPostURLS');
        });
    }

    async PR_CORE(i, channel){
        await rp({
            uri:this.MAIN_URL + this.POST_URL[i][0],
            headers:{
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 OPR/78.0.4093.153"
            } 
        })
        .then((html) => {
            let root = parser.parse(html);
    
            let s = root.querySelector('#image');
            if(s != null && s != ""){
                let url = s.getAttribute('src');
                if(url != "" && url != null){
                    this.URLS.push([url, this.POST_URL[i][1], this.POST_URL[i][2]])
                    //console.log(url);
                }
            }else this.DB_Add_ID(this.POST_URL[i][2], this.POST_URL[i][1]);
        })
        .catch((error) => {
          console.error("Error: PrepireUrls: " + error);
        });
    }

    f_mode = 0;
    async PrepireUrls(){
        for(let i = 0; i < this.POST_URL.length; i++){
            if(this.f_mode < 10)
                await delay(5000);
            await delay(100);
            //URLS_CHECK();

            await db.get("SELECT COUNT(image_id) FROM used_images WHERE image_id LIKE "+this.POST_URL[i][1]+" AND channel LIKE \""+this.channel+"\"", async (err, row) => {
                if(row['COUNT(image_id)'] <= 0){
                    this.f_mode = 0;
                    await this.PR_CORE(i, this.POST_URL[i][2]);
                }
                else{
                    this.f_mode++;
                    //console.log(f_mode+ " skip: " + POST_URL[i][1]);
                }
            });
        }
    }

    ds_end = false;
    async interval_ds_push() {
        try{
            if(client == null) return;
            if(client.isReady()){
                if(!this.ds_end){
                    this.ds_end = true;
                        for (let i = 0; i < this.URLS.length; i++)
                        {
                            let skip = false;
                            for(let x = 0; x < this.URLS_USED.length; x++) if(this.URLS_USED[x][1] == this.URLS[i][1] && this.URLS_USED[x][2] == this.URLS[i][2]) skip = true;
                            if(skip) continue;
                            
                            client.channels.cache.get(this.URLS[i][2]).send(this.URLS[i][0]);
                            this.URLS_USED.push(this.URLS[i]);
                            this.DB_Add_ID(this.channel, this.URLS[i][1]);
                            //console.log(i +"/"+this.URLS.length+" push: " + this.URLS[i][1]);
                            WriteLine(this.channel + ": " + i +"/"+this.URLS.length+" push: " + this.URLS[i][1]);
                            await delay(5000);
                            if(i % 10 == 0 && i != 0) break;
                        }

                        this.URLS_CHECK();
                        this.CLEAR_CASH();
                        //console.log("POST_URL: " + this.POST_URL.length + " URLS_CASHE: " + this.URLS_CASHE.length + " URLS: " + this.URLS.length + " URLS_USED: " + this.URLS_USED.length);
                        this.ds_end = false;
                }   
            }
        }
        catch (err){
            //console.log("error: discord send function: " + err);
            WriteLine(this.channel + ": " + "error: discord send function: " + err);
        }
        finally{
            this.ds_end = false;
        }
    }

    URLS_CHECK(){
        for(let i = 0; i < this.URLS_USED.length; i++)
        {
            for(let j = 0; j < this.URLS.length; j++)
            {
                if(this.URLS_USED[i] == this.URLS[j])
                {
                    this.URLS_CASHE.push(this.URLS[j]);
                }
            }
        }
    }

    CLEAR_CASH(){
        for (let i = 0; i < this.URLS_CASHE.length; i++)
        {
            while(this.POST_URL.length > 1000){
                this.POST_URL = this.POST_URL.splice(0, 100);
            }

            if (this.URLS.indexOf(this.URLS_CASHE[i]) > -1){
                this.URLS = this.URLS.splice(this.URLS.indexOf(this.URLS_CASHE[i]), 1);
                //URLS.Remove(URLS_CASHE[i]);
            }

            if (this.URLS_USED.indexOf(this.URLS_CASHE[i]) > -1){
                this.URLS_USED = this.URLS_USED.splice(this.URLS_USED.indexOf(this.URLS_CASHE[i]), 1);
            }
                //URLS_USED.Remove(URLS_CASHE[i]);
        }

        this.URLS_CASHE = [];
    }

    last_id = 0;
    overflow = false;
    async GetContent(){
        try{
            for(let i = 0; i < this.tags.length; i++){
                if(this.URLS.length > 100 && !this.overflow){
                    this.last_id = i;
                    this.overflow = true;
                    break;
                }
                else if(this.URLS.length < 100 && this.overflow){
                    i = this.last_id;
                    this.overflow = false;
                }
                if(this.overflow) {await delay(30000); break;}
                await this.getPostsURLS("https://rule34.xxx/index.php?page=post&s=list&tags=" + this.tags[i], this.channel);
                await delay(10000);
            }
        }
        catch{
            WriteLine(this.channel + ": " + "error: GetContent");
            //console.log("error: GetContent");
        }
    }

    _gpuWork = false;
    async interval_GetContent() {
        if(this._gpuWork) return;
        this._gpuWork = true;
        try{
            await this.GetContent();
        }
        catch (error){
            //console.log("error: MAIN getPostsURLS: tags: " + error) ;
            WriteLine(this.channel + ": " + "error: MAIN getPostsURLS: tags: " + error);
        }
        finally{
            this._gpuWork = false;
        }
    }

    _puWork = false;
    async interval_PrepireUrls() {
        if(this._puWork) return;
        this._puWork = true;
        try{
            await this.PrepireUrls();
        }
        catch{
            //console.log("error: MAIN PrepireUrls");
            WriteLine(this.channel + ": " + "error: MAIN PrepireUrls");
        }
        finally{
            this._puWork = false;
        }
    }
}

var client = null;

function Init(){
    try{
        client = new discord.Client({ intents: [discord.GatewayIntentBits.Guilds] });
        client.login("MTE4NDE2MDUzMDY2ODIwMDEwOA.Gp82Ns.5cmDSmXBVRCWeni5buuWw0Yk_f_Gi-fFsMDLFw")
        client.on('ready', () => {
            //console.log(`Logged in as ${client.user.tag}!`);
            WriteLine(`Logged in as ${client.user.tag}!`);
        });
}
    catch{
        //console.log("error: discord connection error");
        WriteLine("error: discord connection error");
    }
}

async function GET_REQUEST(url)
{
    await rp({
        uri:url,
        headers:{
            'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 OPR/78.0.4093.153"
        } 
    })
    .catch((error) => {
        console.error('ERROR: GET_REQUEST');
    });
}

async function updateIP(){
    try{
        await getIP(async (err, ip) => {
            if (err) {
                //console.log("error: updateIP")
                WriteLine("error: updateIP");
            }
            await GET_REQUEST("https://hexwebcore.ru/current_ip.php?new=" + ip);
        });
    }
    catch{
        
    }
}

var bots = [];

function StartAPP(){
    Init();
    InitBots();
}

function RestartBot(){
    bots.forEach(element => {
        ClearIntervals(element);
    });
    bots = [];
    StartAPP();
}

setInterval(async() => await RestartBot(), 60000*24*60);
setInterval(async () => await updateIP(), 10000);

function InitNewBot(channel, tags){
    let bot = new HornyBOT(channel, tags);
    AddIntervals(bot);
    bots.push[bot];
}

function InitBots(){
    InitNewBot('1185623640574787614', ['ai_generated']); // ai
    InitNewBot('1185623743544963233', ['genshin_impact']); // auto
    InitNewBot('1185622160052604999', ['all']); //rule34
    InitNewBot('1185622110404616312', ["kumasteam", "azto_dio", "spicy_moo", "thing_(athing)",
    "kirill782", "remon11", "lewdcreationsai", "prrrab", "ahegaokami", 
    "kakure_eria", "melowh", "greatodoggo", "yampa", // 50|50
    "koahri", "houraku", "daebom", "genek", "khyleri", "beijuu",
    // "rocksolidart", //meybe... not....
    ]); //auto
}

StartAPP();

function getAllElement(text, rgx)
{
    let tmp_s = "";

    let firstIndex = 0;
    let lastIndex = 0;

    let skip = false;

    let elements = [];

    for (let rg = 0; rg < rgx.length; rg++)
    {
        for (let t = lastIndex; t < text.length; t++)
        {
            skip = false;

            for (let i = 0; i < rgx[rg].length; i++)
            {
                if (text[t] == rgx[rg][i])
                {
                    tmp_s += text[t];
                    t++;

                    if (tmp_s == rgx[rg])
                    {
                        for (let first = t; first > 0; first--)
                        {
                            if (text[first] == '<')
                            {
                                firstIndex = first;
                                for (let last = t; last < text.length; last++)
                                {
                                    if (text[last] == '>')
                                    {
                                        lastIndex = last;

                                        let textOnly = "";
                                        for (let r = firstIndex; r < lastIndex; r++)
                                        {
                                            textOnly += text[r];
                                        }

                                        //return textOnly + ">";
                                        elements.push(textOnly + ">");
                                        skip = true;
                                        break;
                                    }
                                }
                            }
                            if (skip)
                                break;
                        }
                    }
                }
                else
                {
                    tmp_s = "";
                    break;
                }
                if (skip)
                    break;
            }
            tmp_s = "";
        }
    }
    //console.log("ELEMENTS: " + elements.length);
    return elements;
}

function getElement(text, rgx)
{
    let tmp_s = "";

    let firstIndex = 0;
    let lastIndex = 0;

    for(let t = 0; t < text.length; t++)
    {
        for(let i = 0; i < rgx.length; i++)
        {
            if(text[t] == rgx[i])
            {
                tmp_s += text[t];
                t++;

                if (tmp_s == rgx)
                {
                    for (let first = t; first > 0; first--)
                    {
                        if (text[first] == '<')
                        {
                            firstIndex = first;
                            for (let last = t; last < text.length; last++)
                            {
                                if (text[last] == '>')
                                {
                                    lastIndex = last;

                                    let textOnly = "";
                                    for (let r = firstIndex; r < lastIndex; r++)
                                    {
                                        textOnly += text[r];
                                    }

                                    return textOnly + ">";
                                }
                            }
                        }
                    }
                }
            }
            else
            {
                tmp_s = "";
                break;
            }
        }
    }
    return "< NULL >";
}

function getText(text, start, stop)
{
    let tmp_s = ""; // value="
    let tmp_st = ""; // "

    let _start = false;

    let firstIndex = 0;
    let lastIndex = 0;

    for (let t = 0; t < text.length; t++)
    {
        if (!_start) {
            for (let s = 0; s < start.length; s++)
            {
                if (text[t] == start[s])
                {
                    tmp_s += text[t];
                    t++;

                    if (tmp_s == start)
                    {
                        firstIndex = t;
                        _start = true;
                        break;
                    }
                }
                else
                {
                    tmp_s = "";
                    break;
                }
            }
        }

        if (_start)
        {
            for (let st = 0; st < stop.length; st++)
            {
                if (text[t] == stop[st])
                {
                    tmp_st += text[t];
                    t++;
                }
                else
                {
                    tmp_st = "";
                }
            }

            if(tmp_st == stop)
            {
                lastIndex = t - 1;
                break;
            }
        }
    }

    let result = "";
    for(let i = firstIndex; i < lastIndex; i++)
    {
        result += text[i];
    }

    return result;
}

function getTextARR(text, start, stop)
{
    let tmp_s = ""; // value="
    let tmp_st = ""; // "

    let _start = false;

    let firstIndex = 0;
    let lastIndex = 0;

    for (let t = 0; t < text.length; t++)
    {
        if (!_start)
        {
            for (let s = 0; s < start.length; s++)
            {
                if (text[t] == start[s])
                {
                    tmp_s += text[t];
                    t++;

                    if (tmp_s == start)
                    {
                        firstIndex = t;
                        _start = true;
                        break;
                    }
                }
                else
                {
                    tmp_s = "";
                    break;
                }
            }
        }

        if (_start)
        {
            for (let stop_c = 0; stop_c < stop.length; stop_c++)
            {
                for (let st = 0; st < stop[stop_c].length; st++)
                {
                    if (text[t] == stop[stop_c][st])
                    {
                        tmp_st += text[t];
                        t++;
                    }
                    else
                    {
                        tmp_st = "";
                    }
                }

                if (tmp_st == stop[stop_c])
                {
                    lastIndex = t - 1;
                    break;
                }

                tmp_st = "";
            }
        }
    }

    let result = "";
    for (let i = firstIndex; i < lastIndex; i++)
    {
        result += text[i];
    }

    return result;
}