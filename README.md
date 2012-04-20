What is fraggle
---------------

A command line utility to deploy different versions of nodejs applications. You define a main host (i.e: www.example.dev) and you can deploy different versions of your app, each one in its own subdomain (i.e: 1.www.example.dev, 2.www.example.dev and so on). Fraggle then:

  - Downloads the source code and changes the working directory to a given version (usually a tagged commit). At this moment only git repositories are supported.
  - Changes the proxy configuration to add the new host with that version. At this moment only haproxy is supported.

This project is actually a forked versionn of fraggle for haproxy addapted to an specific nginx configuration.

Changelog
----------
This fork includes support to nginx in two different ways: starting service from command line, or delegating nginx start to the init.d script and automating the deployment (in the meantime there is a very specific implementation which will be turned to something more general in future version).


Currently a settings file has been addeed so it has to be edited before using fraggle.

Getting started
---------------

You can install fraggle with `npm``

    npm install fraggle -g

Create a new directory. For example `services` NOTE: This is not really used

    mkdir services

Create an empty configuration file

    echo '{}' > config.json

Create a haproxy.ejs template. You can use [this example](https://github.com/gimenete/fraggle/blob/master/haproxy.ejs). Save (and modify if you want) the template as `haproxy.ejs` in the current directory.

Usage
-----

First of all edit the file settings.js with the required information. If you are using haproxy then you this is the mininal settings configuration:

var settings = {}

To use fraggle with nginx use a configuration like the next:

var settings = {
    defaultConfFile     : 'config.json',    // fruggle conf file, defaults to config.json
    serverTemplate      : 'nginx.ejs',      // the server configuration template (for nginx, haproxy...)
    nginx               : true,             // is the server nginx? Then next possible values:
    nginxConfPath       : '/etc/nginx/',    //  the nginx file configuration path
    nginxConfFile       : 'node-default',   //  the ouput nginx configuration file in nginxConfPath folder
    appPort             : 80,
}


**Adding services**

To add a service to the configuration file. Use:

    fraggle add <domain> <repo> <executable-file>

For example:

    fraggle add www.example.dev git@github.com:gimenete/myserver.git server.js

The executable file will be invoked with the port number in which it should listen as the frist parameter.

At this moment nothing is running. You just added a service to the configuration file. Now you need to deploy a version.

**Deploying versions**

To deploy a new version just use:

    fraggle deploy <tag>.<domain>

For example:

    fraggle deploy 1.www.example.dev

This will download the source code of the repository in a new directory: `repos/1.www.example.dev` checking out the given tag ('1' in this case). Fraggle will run the <executable-file> with an available port as first parameter, and will restar the proxy with the new configuration. It uses [forever](https://github.com/indexzero/forever) to keep it running forever :) And log files are stored inside the `logs` directory that will be created if does not exist.

At this moment you can browse http://1.www.example.dev to see the new deployed version.

**Marking a version as the default one**

Now you would want to have some version serving at http://www.example.dev You just need to use:

    fraggle default <tag>.<domain>

For example:

    fraggle default 1.www.example.dev

So you now can browse http://www.example.dev

**Deleting versions**

If you want to delete a version, you just need to do the following:

    fraggle delete <tag>.<domain>

For example:

    fraggle delete 1.www.example.dev

Fraggle will stop the service, and it also will delete the application directory and will restart the proxy with the new configuration.

**Listing active services**

You can list the active services by simply using:

    fraggle list

It will show you the configured domains, with their versions, the port where they are running, and which of them is the default version (marked as PROD in the listing).
