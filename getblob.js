function getBlob (img) {
  let canvas = document.createElement('canvas');
  let context = canvas.getContext('2d');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  context.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
  let imgDataURL = canvas.toDataURL();
  return imgDataURL;
}

