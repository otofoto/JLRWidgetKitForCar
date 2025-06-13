const FILE_MGR = FileManager[module.filename.includes('Documents/iCloud~') ? 'iCloud' : 'local']();

async function fetchAndSaveScript(scriptName, url) {
    try {
        const REQ = new Request(url);
        const RES = await REQ.load();
        FILE_MGR.write(FILE_MGR.joinPath(FILE_MGR.documentsDirectory(), scriptName), RES);
        console.log(`✅ Script '${scriptName}' successfully saved.`);
    } catch (error) {
        console.error(`❌ Error downloading script '${scriptName}':`, error);
    }
}

(async () => {
    const scriptName = 'Jaguar Travel.js';
    const scriptURL = 'https://gitee.com/wangningkai/scriptable-scripts/raw/master/jaguar/jaguar.js';
    
    await fetchAndSaveScript(scriptName, scriptURL);

    FILE_MGR.remove(module.filename);
    Safari.open(
        'scriptable:///open?scriptName=' + encodeURIComponent('Jaguar Travel')
    );
})();
