const {By, Builder, Browser} = require('selenium-webdriver');
const assert = require("assert");
const fs = require('fs');
const os = require('os');

const homeDir = os.homedir();
const imgUrl = "blob:https://drive.google.com/";
const imgPreamble = "data:image/png;base64,";
const getBlob = fs.readFileSync(__dirname + "/getblob.js", "utf8");

if (!process.argv[3]) {
  var urlFile = process.argv[2];
  if (!urlFile || !fs.existsSync(urlFile)) {
    console.log("Can't find the URL file\n");
    process.exit();
  }
  var urls = [];
  var urlLines = fs.readFileSync(urlFile, "utf8").split("\n");
  for (var i = 0; i<urlLines.length; i++)
    urls.push(urlLines[i].split(" "));
} else {
  var urls = [[process.argv[2], process.argv[3]]];
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// We find all images that have a src looks like "blob:https...".
// These are the ones that contain the actual images.
async function getImages(driver) {
  var images = await driver.findElements(By.tagName("img"));
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
  var dir = homeDir + "/Downloads/" + doc;
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }
  var images = await getImages(driver);;
  for (var i = 0; i<images.length; i++) {
    var blob = await
    // We use the JS function from the getblob.js file.  It copies the
    // image over to a canvas, and then returns the image as a base64
    // data: URL.
    driver.executeScript(getBlob + "\n return getBlob(arguments[0]);",
			 images[i]);
    blob = blob.substring(imgPreamble.length);
    // Decode the base64.
    var buff = Buffer.from(blob, "base64");
    var seq = "" + (i+1);
    while (seq.length < 3)
      seq = "0" + seq;
    fs.writeFileSync(dir + "/page-" + seq + ".png", buff);
  }
}

async function download() {
  // The URL file is on the form ITEM-NAME URL.  We create directories
  // called ~/Download/ITEM-NAME/ and put all the pages from URL
  // there.
  for (var nurl = 0; nurl < urls.length; nurl++) {
    var [doc, url] = urls[nurl];
    if (!url)
      continue;
    try {
      var driver = await new Builder().forBrowser(Browser.FIREFOX).build();
      await driver.get(url);
      // Wait until we get the first image before doing anything.
      var images = await getImages(driver);
      while (images.length == 0) {
	console.log("Waiting for the first image");
	await sleep(400);
	images = await getImages(driver);
      }

      // Find the largest element on the page.  This is the one that
      // will contain all the page images and that we need to scroll
      // later to actually load all the pages.
      var largestHeight = 0;
      var largestElem = false;
      var elems = await driver.findElements(By.tagName("div"));
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

      // OK, we now know what to do, so scroll until we reach the end,
      // and then save the pages.
      var scroll = 0;
      while (true) {
	scroll += 450 + Math.floor(Math.random() * 100);
	await driver.executeScript("arguments[0].scrollTo(0, arguments[1]);",
				   largestElem, scroll);
	var scrolledTo = parseInt(await largestElem.getAttribute("scrollTop"));
	var nowHeight = parseInt(await largestElem.getAttribute("scrollHeight"));
	var displayHeight = parseInt(await largestElem.getAttribute("clientHeight"));
	if (scrolledTo + displayHeight + 500 >= nowHeight) {
	  console.log("Bottom; saving");
	  await saveImages(driver, doc);
	  await driver.quit();
	  break;
	}
	console.log("Scrolled to " + scrolledTo + " out of " + nowHeight);
	await sleep(350 + Math.floor(Math.random() * 100));
      }
    } catch (e) {
      // We had an error while fetching.
      console.log("Error while fetching " + url);
      console.log(e);
      try {
	await driver.quit();
      } catch(e) {}
    }
    await sleep(4000);
  }
}

download();