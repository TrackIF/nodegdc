"use strict";

var ftp             = require('ftp');
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



/***************** Expose/Export Functionality *****************/

  /*
   * Expose public API calls
   */ 

  this.getSLITemplate     = getSLITemplate;



  return this;
}

module.exports = GdcDataSet;