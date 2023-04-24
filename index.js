/**
 * http://localhost:3000/deviantart-search?keyword=anime&count=50 (max 500)
 * http://localhost:3000/deviantart-search?keyword=anime (default 24)
 * http://localhost:3000/deviantart-topic?path=/topic/3d&count=50 (max 500)
 * http://localhost:3000/deviantart-topic?path=/topic/3d (default 24)
 * http://localhost:3000/get-topic (get all topic)
*/

const axios = require('axios');
const fs = require('fs-extra');
const express = require('express');
const app = express();
const cors = require('cors');


app.use(cors());
app.set('json spaces', 4);
app.get('/', (req, res) => res.send('Hello World!'));
app.listen(3000, () => console.log('Example app listening on port 3000!'));
app.get('/deviantart-search', async (req, res) => {
  const { keyword, cursor, count = 24 } = req.query;
  let pathFile = './data search.json';
  let dataFile = {};
  let saveFile = ()=>fs.writeFileSync(pathFile, JSON.stringify(dataFile));
  
  if(!fs.existsSync(pathFile))saveFile();dataFile = JSON.parse(fs.readFileSync(pathFile));
  if(!dataFile.search)dataFile.search = {};
  if(count > 500) return res.json({ error: true, message: 'count is too large, max: 500' });
  if(!keyword) return res.json({ error: true, message: 'keyword is required, example: anime' });
  
  const data = dataFile.search[keyword] || await getImagePage({ type: 'search', keyword, count, data: [] }, cursor);dataFile.search[keyword] = data;saveFile();
  if(!data) return res.json({ error: true, message: 'keyword is invalid, example: anime' });
  res.json({
    length: data.result.length,
    cursor: data.cursor,
    data: data.result
  });
});

app.get('/get-topic', async (req, res) => {
  const data = await getAllTopic();
  res.json(data);
});

app.get('/deviantart-topic', async (req, res) => {
  const { path, cursor, count = 24 } = req.query;
  if(count > 500) return res.json({ error: true, message: 'count is too large, max: 500' });
  if(!path) return res.json({ error: true, message: 'path is required, example: /topic/photography' });
  const data = await getImagePage({ type: 'topic', path, count, data: [] }, cursor);
  if(!data) return res.json({ error: true, message: 'path is invalid, example: /topic/photography' });
  res.json({
    length: data.result.length,
    cursor: data.cursor,
    data: data.result
  });
});

const getImagePage = async (data, cursor) => {
  const url = data.type === 'search'
    ? `https://www.deviantart.com/search?q=${encodeURIComponent(data.keyword)}${cursor ? `&cursor=${cursor}` : ''}`
    : `https://www.deviantart.com${data.path}${cursor ? `?cursor=${cursor}` : ''}`;
  try {
    const { data: get } = await axios.get(url);
    const unescaped = unescape(get).replace(/\\/g, '');
    const curuserRegex = /"cursor":"([^"]*)"/;
    const cursorHtml = curuserRegex.test(unescaped) ? unescaped.match(curuserRegex)[1] : '';
    const entitiesJson = JSON.parse(unescaped.split('@@entities":')[1].split(',"@@CommentEditor"')[0]);

    var result = Object.values(entitiesJson.deviation || {})
      .filter(entity => entity)
      .map(({ deviationId: id, type, title, url, publishedTime, isDownloadable, stats, author, media }) => ({
        
        downloadUrl: `${media.baseUri}${media.types.find(({ t }) => t === 'fullview')?.c?.replace('<prettyName>', media.prettyName) ?? ''}${media.token ? `?token=${media.token[0]}` : ''}`,
      }));
    data.data = [...data.data, ...result];
    if (data.data.length > data.count) {
      data.data = data.data.slice(0, data.count);
    }
    if (data.data.length < data.count) {
      return await getImagePage(data, cursorHtml);
    }
    return { cursor: cursorHtml, result: data.data };
  } catch (error) {
    console.error(error);
    return false;
  }
};


const getAllTopic = async () => {
  try {
    const { data } = await axios.get("https://www.deviantart.com/topic")
    const initialStateRegex = /window.__INITIAL_STATE__ = ([^;]*)/g;
    const entitiesRegex = /"@@BROWSE_PAGE_STREAM":([^;]*)/g;
    const [initialStateJson] = data.match(initialStateRegex).map(match => unescape(match.replace('window.__INITIAL_STATE__ = JSON.parse("', '')).replace(/\\/g, ''));
    const [entitiesJson] = initialStateJson.match(entitiesRegex).map(match => JSON.parse(match.replace('"@@BROWSE_PAGE_STREAM":', '').split('},"@@entities":')[0]));
    return entitiesJson.items.map(({ typeId, itemId, name, url, description }) => ({ typeId, itemId, name, url, description }));
  }
  catch (error) {
    return false;
  }
}

function unescape(str) {
  return str.replace(/\\u([0-9a-fA-F]{4})/g, function (match, grp) {
      return String.fromCharCode(parseInt(grp, 16));
  });
}
