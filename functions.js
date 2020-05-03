const fs = require('fs');

module.exports = {
    saveImage (img) {
        let imgData = fs.readFileSync(img.path);
        let arr = img.name.split('.');
        let imgName = `${arr[0] + Date.now()}.${arr[1]}`;
        fs.writeFileSync('./static/images/' + imgName, imgData);
        return imgName;
    },
    deleteImage (imgSrc) {
        fs.unlinkSync('./static/' + imgSrc);
    },
    getDateTime (param) {
        let oDate = null;
        if (param) {
            oDate = param;
        } else {
            oDate = new Date();
        }
        let year = oDate.getFullYear();
        let month = oDate.getMonth() + 1;
        month = month < 10 ? '0' + month : month;
        let date = oDate.getDate();
        date = date < 10 ? '0' + date : date;
        let hours = oDate.getHours();
        hours = hours < 10 ? '0' + hours : hours;
        let minutes = oDate.getMinutes();
        minutes = minutes < 10 ? '0' + minutes : minutes;
        let seconds = oDate.getSeconds();
        seconds = seconds < 10 ? '0' + seconds : seconds;
        return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
    }
}