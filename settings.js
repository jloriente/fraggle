var settings = {
    defaultTemplateID : 'config.json',
    nginx             : true,        // Use nginx or haprox
    appPort           : 80,
}
exports.get = function(id, defaultValue){
    return settings[id] || defaultValue;
}
exports.isNginx = function(){
    return settings.nginx || false;
}
