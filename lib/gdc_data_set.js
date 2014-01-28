"use strict";

var Ftp             = require('ftp');
var fs              = require('fs');
var zip             = require('node-zip');
var _               = require('lodash');
var request         = require('request');
var Q               = require('q');

function GdcDataSet(gdc, identifier) {

  var sli              = [];


  /*
   * GET:     Parse the details from a SLI manifest file
   * RETURN:  pass/fail promise
   */
  var parselater = function() {
    var d = Q.defer();
    
    // d.resolve(data);
    // d.reject(err);

    return d.promise;
  }


  /*
   * GET:     SLI dataset template
   * RETURN:  string containing filename downloaded
   */
  var getSLITemplate = function() {
    var d = Q.defer();
    var zipFileName = '/tmp/gdc-template-' + 
                    identifier + 
                    '-' + 
                    Math.floor(Math.random()*999999999999) + 
                    '.zip';

    var zipfile = fs.createWriteStream(zipFileName);

    gdc.__request('GET', gdc.GDC_API_SLI + '/' + identifier + '/template', null, {'Accept' : 'application/zip'})
      .then(function(resp) {
        var status = resp.pipe(zipFileName);
        status.on('finish', function() { d.resolve(); })
      }, function(err) {
        d.reject(err);
      })
    return d.promise;
  }



  /*
   * The action command. This calls our data uploader and executes
   * a command on GDC's server notifying them of the upload
   * RETURN:  pas/fail promise
   */
  var doETL = function() {
    var d = Q.defer();

    if (typeof sli['uploadfile'] === 'undefined') {
      d.reject('Call prepareLoad method first');
    }


    doUpload()
      .then(function(dir) {
        gdc.__request('POST', gdc.GDC_API_ETL, { pullIntegration: dir })
          .then(function(body) {
            d.resolve(body);
          }, function(err) {
            d.reject(err);
          })
      }, function(err) {
        d.reject(err);
      })


    return d.promise;
  }


  /*
   * UPLOAD:  Uploads zip file to working directory on GDC server
   * RETURN:  Returns string of the random directory created
   */
  var doUpload = function() {
    var d = Q.defer();

    var ftp = new Ftp();
    var dir = Math.floor(Math.random()*999999999999);

    var ftp_options = {
      host:     gdc.GDC_FTP_SERVER,
      user:     gdc.__user.email, 
      password: gdc.__user.password,
      secure:   true,

    }

    ftp.on('ready', function() {
      ftp.put(sli['uploadfile'], '/' + dir + '/upload.zip', function(err) {
        if (err) {
          ftp.end();
          d.reject(err);
        } else {
          ftp.end();
          d.resolve(dir);
        }
      });
    });

    ftp.connect();

    return d.promise;
  }



/***************** Expose/Export Functionality *****************/

  /*
   * Expose public API calls
   */ 

  this.getSLITemplate     = getSLITemplate;
  this.doETL              = doETL;


  return this;
}

module.exports = GdcDataSet;