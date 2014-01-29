"use strict";

var Ftp             = require('ftp');
var fs              = require('fs');
//var zip             = require('node-zip');
var _               = require('lodash');
var request         = require('request');
var Zip             = require('adm-zip');
var Q               = require('q');

function GdcDataSet(gdc, identifier) {

  var sli = [];

  var _rand = function() {
    return Math.floor(Math.random()*999999999999);
  }


  var _arrayFlip = function(trans) {
    var key, tmpArray = {};

    for (key in trans) {
      if (trans.hasOwnProperty(key)) tmpArray[trans[key]] = key;
    }

    return tmpArray;
  }


  var _arrayKeys = function(arr) {
    var tmpArray = []
    for (var key in arr) {
      tmpArray.push(key);
    }
    return tmpArray;
  }


  /*
   * GET:     SLI dataset template
   * RETURN:  pass/fail promise /w zip path
   */
  var _getSLITemplate = function() {
    var d = Q.defer();
    var zipFileName = './tmp/gdc-template-' + 
                    identifier + 
                    '-' + 
                    _rand() + 
                    '.zip';

    sli['template'] = zipFileName;

    gdc.__download(gdc.GDC_API_SLI + '/' + identifier + '/template', zipFileName)
      .then(function() {
        d.resolve(zipFileName);
      }, function(err) {
        d.reject(err);
      })
    return d.promise;
  }


  /*
   * Download and read details from SLI manifest
   * RETURN:  pass/fail promise
   */
  var _readSLITemplate = function() {
    var d = Q.defer();
    var zip = Zip(sli['template']);

    zip.getEntries().forEach(function(entry) {
      switch(entry.name) {
        case 'upload_info.json':
          var decompressedData = zip.readFile(entry);
          sli['info'] = JSON.parse(zip.readAsText(entry));
          break;
        case identifier + '.csv':
          var decompressedData = zip.readFile(entry);
          sli['csv'] = _arrayFlip(zip.readAsText(entry).split(','))
          break;
        default:
          break;
      }
    });

    d.resolve();

    return d.promise;
  }


  // Combines _get and _read functions for SLI templates into single promise
  var downloadConfig = function() {
    var d = Q.defer();

    _getSLITemplate()
      .then(function() { return _readSLITemplate() })
      .then(function() {
        d.resolve(sli);
      }, function(err) {
        d.reject(err);
      });

    return d.promise;
  }


  /*
   * Get list of CSV column names
   * RETURN:  pass/fail promise with sorted data in resolve
   */
  var getCSVColumns = function() {
    return _arrayKeys(sli['csv']).sort();
  }



  var _getCSVColumnCount = function() {
    return sli['csv'].length;
  }



  var _readSLIManifest = function() {
    var d = Q.defer();

      sli['info'].dataSetSLIManifest.parts.forEach(function(column) {
        gdc.getObject(column.populates[0])
          .then(function(obj) { 
            
            sli['csv'][column.columnName] = {
              'title':      obj[0].meta.title,
              'uri':        obj[0].meta.uri,
              'category':   obj[0].meta.category,
              'identifier': obj[0].meta.identifier,
            }

          });
      });

      d.resolve();

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
      d.reject('Call prepareUpload method first');
    } else {
      _doUpload()
        .then(function(dir) {
          gdc.__request('POST', gdc.GDC_API_ETL, { pullIntegration: dir })
            .then(function(body) {
              d.resolve(body);
            }, function(err) {
              d.reject(err);
            });
        }, function(err) {
          d.reject(err);
        });
    }
    return d.promise;
  }


  /*
   * Converts multi-dimensional array into proper csv data for upload
   * RETURN:  pass/fail promise containing array data
   */
  var _convertDataToCSV = function(data) {
    var d = Q.defer();
    
    var numCols = _getCSVColumnCount();
    var returnData = '';

    if (typeof data === 'object') {

      returnData = getCSVColumns().join(',');

      data.forEach(function(row) {
        returnData += '\n' + row.join(',');
      });

      d.resolve(returnData);

    } else {
      d.reject('Data not in multi-dimensional array format');
    }

    return d.promise;
  }


  /*
   *
   *
   */
  var prepareUpload = function(data) {
    var d = Q.defer();

    var saveZipFile = sli['template'] + '.data.zip';
    var zip = new Zip();

    _convertDataToCSV(data)
      .then(function(returnedData) {
        var csv = returnedData;

        var info = JSON.stringify(sli['info']);

        zip.addFile('upload_info.json', new Buffer(info), 'upload_info');
        zip.addFile(identifier + '.csv', new Buffer(csv), 'csv_data');

        zip.writeZip(saveZipFile);

        sli['uploadfile'] = saveZipFile;

        d.resolve(saveZipFile);

      }, function(err) {
        d.reject(err);
      })

    return d.promise;
  }



  /*
   * UPLOAD:  Uploads zip file to working directory on GDC server
   * RETURN:  Returns string of the random directory created
   */
  var _doUpload = function() {
    var d = Q.defer();

    var ftp = new Ftp();
    var dir = _rand();

    var ftp_options = {
      host:     gdc.GDC_FTP_SERVER,
      user:     gdc.__user.email, 
      password: gdc.__user.password
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

    ftp.on('error', function(err) {
      console.log('-- FTP ERROR --')
      console.log(err);
      console.log('-- FTP OPTIONS --');
      console.log(ftp_options);
    });

    ftp.connect();

    return d.promise;
  }



/***************** Expose/Export Functionality *****************/

  /*
   * Expose public API calls
   */ 

  this.downloadConfig     = downloadConfig;
  this.getCSVColumns      = getCSVColumns;
  this.prepareUpload     = prepareUpload;
  this.doETL              = doETL;


  return this;
}

module.exports = GdcDataSet;