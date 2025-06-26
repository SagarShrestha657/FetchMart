import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"
});
console.log("Incognito support:", typeof browser.createBrowserContext);
await browser.close();
