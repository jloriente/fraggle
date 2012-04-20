var settings = {
    defaultConfFile     : 'config.json',    // fruggle conf file, defaults to config.json
    serverTemplate      : 'nginx.ejs',      // the server configuration template (for nginx, haproxy...)
    nginx               : true,             // is the server nginx? Then next possible values:
    nginxConfPath       : '/etc/nginx/node',    //  the nginx file configuration path
    nginxConfFile       : 'node-default',   //  the ouput nginx configuration file in nginxConfPath folder
    appPort             : 80,
}
exports.get = function(id, defaultValue){
    return settings[id] || defaultValue;
}
exports.isNginx = function(){
    return settings.nginx || false;
}
