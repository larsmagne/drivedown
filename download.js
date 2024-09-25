const {By, Builder, Browser} = require('selenium-webdriver');
const assert = require("assert");
var fs = require('fs');
const os = require('os');

var homeDir = os.homedir();

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const imgUrl = "blob:https://drive.google.com/";
const imgPreamble = "data:image/png;base64,";
var getBlob = fs.readFileSync(__dirname + '/getblob.js', 'utf8');

async function getImages(driver) {
  var images = await driver.findElements(By.tagName('img'));
  var found = [];
  for (var i = 0; i<images.length; i++) {
    var src = await images[i].getAttribute("src");
    if (src &&
	src.length >= imgUrl.length &&
	src.substring(0, imgUrl.length) == imgUrl) {
      found.push(images[i]);
    }
  }
  return found;
}

async function saveImages(driver, doc) {
  var dir = homeDir + '/Downloads/' + doc;
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }
  var images = await getImages(driver);;
  for (var i = 0; i<images.length; i++) {
    var blob = await
    driver.executeScript(getBlob + "\n return getBlob(arguments[0]);",
			 images[i]);
    blob = blob.substring(imgPreamble.length);
    let buff = Buffer.from(blob, 'base64');
    var seq = "" + (i+1);
    while (seq.length < 3)
      seq = "0" + seq;
    fs.writeFileSync(dir + "/page-" + seq + ".png", buff);
  }
}

var urlFile = process.argv[2];
if (!urlFile || !fs.existsSync(urlFile)) {
  console.log("Can't find the URL file\n");
  process.exit();
}

(async function download() {
  let driver;

  var urls = fs.readFileSync(urlFile, 'utf8').split("\n");
  for (var nurl = 0; nurl < urls.length; nurl++) {
    var [doc, url] = urls[nurl].split(" ");
    if (!url)
      continue;
    try {
      driver = await new Builder().forBrowser(Browser.FIREFOX).build();
      await driver.get(url);
      var images = await getImages(driver);
      while (images.length == 0) {
	console.log("Waiting for the first image");
	await sleep(400);
	images = await getImages(driver);
      }
      
      var largestHeight = 0;
      var largestElem = false;
      var elems = await driver.findElements(By.tagName('div'));
      for (var i = 0; i<elems.length; i++) {
	var height = 0;
	try {
	  height = parseInt(await elems[i].getAttribute("scrollHeight"));
	} catch(e) {}
	if (height > largestHeight) {
	  largestHeight = height;
	  largestElem = elems[i];
	};
      }
      console.log(largestHeight);
      console.log(await largestElem.getAttribute("class"));

      var scroll = 0;
      while (true) {
	await driver.executeScript("arguments[0].scrollTo(0, arguments[1]);",
				   largestElem, scroll);
	scroll += 450 + Math.floor(Math.random() * 100);
	var scrolledTo = parseInt(await largestElem.getAttribute("scrollTop"));
	var nowHeight = parseInt(await largestElem.getAttribute("scrollHeight"));
	var displayHeight = parseInt(await largestElem.getAttribute("clientHeight"));
	if (scrolledTo + displayHeight + 500 >= nowHeight) {
	  await saveImages(driver, doc);
	  console.log("Bottom");
	  await driver.quit();
	  break;
	}
	await sleep(400);
	console.log("Scrolling");
	console.log([scrolledTo, largestHeight, nowHeight, displayHeight]);
      }
    } catch (e) {
      console.log(e);
    } finally {
      //await driver.quit();
    }
  }
}())
