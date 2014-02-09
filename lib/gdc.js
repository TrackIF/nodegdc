"use strict";

/*
 *  https://developer.gooddata.com/api
 */

var package_json    = require('./../package.json');
var GdcDataSet      = require('./gdc_data_set')
var request         = require('request');
var Q               = require('q');
var fs              = require('fs');
var _               = require('lodash');

var gdc = function(email, password, project, logEnabled) {

  if( !(this instanceof gdc) ) {
    return new gdc(email, password, project, logEnabled);
  }


  var GDC_REST_SERVER   = 'https://na1.secure.gooddata.com/gdc';
  var GDC_DI_SERVER     = 'https://na1-di.gooddata.com';

  var GDC_COOKIE_AUTH   = 'GDCAuthSST';
  var GDC_COOKIE_TOKEN  = 'GDCAuthTT';
  var GDC_ACCOUNT_PATH  = GDC_REST_SERVER + '/account';
  var GDC_API_LOGIN     = GDC_REST_SERVER + '/account/login';
  var GDC_API_TOKEN     = GDC_REST_SERVER + '/account/token';
  var GDC_API_MD        = GDC_REST_SERVER + '/md';
  var GDC_API_PROJECT   = GDC_REST_SERVER + '/projects/' + project;
  var GDC_API_ETL       = GDC_REST_SERVER + '/md/' + project + '/etl/pull';
  var GDC_API_DATASETS  = GDC_REST_SERVER + '/md/' + project + '/data/sets';
  var GDC_API_SLI       = GDC_REST_SERVER + '/md/' + project + '/ldm/singleloadinterface';
  var GDC_API_ID_TO_URI = GDC_REST_SERVER + '/md/' + project + '/identifiers';


/***************** Internal Use Functions *****************/

  /*
   *  BLOCKING LOG OPERATIONS FTW
   */
  var _log = function(text) {
    if (logEnabled) console.log('NODEGDC\t' + text)
  }


  /*
   * Internal reusable download request
   * RETURN: pass/fail promise of file save
   */
  var _download = function(uri, file, json) {
    var d = Q.defer();
    var defaultHeaders = { 'Accept' : 'application/zip' }

    var fileWriter = fs.createWriteStream(file);

    _log('HITTING: ' + uri);

    fileWriter.on('close', function() {
      _log('DOWNLOAD SUCCESSFUL');
      d.resolve();
    });

    fileWriter.on('error', function(err) {
      _log('DOWNLOAD UNSUCCESSFUL: ' + err)
    })

    request({method: 'GET', jar: true, headers: defaultHeaders, uri: uri, json: json || {}},
      function(err, resp, body) {
        if (err) d.reject(err);
      }).pipe(fileWriter);

    return d.promise;
  }


  /*
   * Internal reusable request object with basic HTTP response code handling
   * RETURN: pass/fail promise with body/error data
   */
  var _request = function(type, uri, json, headerOverride) {
    var d = Q.defer();

    var defaultHeaders = headerOverride || {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }

    _log('HITTING: ' + uri);
    request({ method: type, jar: true, headers: defaultHeaders, uri: uri, json: json || {} },
      function (err, resp, body) {

      if (err) {
        _log(err)
        d.reject(err);
      }

      switch(resp.statusCode) {
        case 200:
        case 201:
        case 204:
          d.resolve(body);
          break;

        case 400:
          var errorMessage = body.error.message
          _.each(body.error.parameters, function(parameter){
            errorMessage = errorMessage.replace('%s', parameter)
          })
          d.reject('400: '+errorMessage);
          break;

        case 401:
          d.reject('401: Unauthorized. Invalid username/password or token');
          break;

        default:
          d.reject(resp.statusCode);
          break;
      }

    })

    return d.promise;
  }


/***************** Authentication Functions *****************/

  /*
   * POST:    user credentials for initial handshake
   * RETURN:  pass/fail promise
   */
  var _getUserAuth = function() {
    var json = {
      'postUserLogin': {
        'login':    email,
        'password': password,
        'remember': 1
      }
    }

    return _request('POST', GDC_API_LOGIN, json);
  }



  /*
   * GET:    refreshable user token for api requests
   * RETURN: pass/fail promise
   */
  var _getUserToken = function() {
    return _request('GET', GDC_API_TOKEN);
  }



  /*
   * GET/POST:  Combines AUTH/TOKEN for full handshake
   * RETURN:    pass/fail promise and body (if any) data
   */
  var login = function() {
    var d = Q.defer();

    _getUserAuth()
      .then(function() { _log('Authorization successful'); return _getUserToken(); })
      .then(function(data) {
        _log('Token successfully pulled. Authorization handshake complete');
        d.resolve(data);
      }, function(err) {
        if (err) d.reject(err);
      })
    return d.promise;
  }



/***************** Project Functions *****************/

  /*
   * GET:     active project information
   * RETURN:  JSON object of project parameters
   */
  var projectInfo = function() {
    return _request('GET', GDC_API_PROJECT)
  }



  /*
   * GET:     list of projects this account can manage
   * RETURN:  Array of JSON objects containing project data
   */
  var listProjects = function() {
    var d = Q.defer();
    var returnList = [];

    _request('GET', GDC_API_MD)
      .then(function(projects) {
        projects.about.links.forEach(function(project) {
          returnList.push({
            name:     project.title,
            token:    project.identifier,
            category: project.category
          })
        });
        d.resolve(returnList);
      }, function(err) {
        d.reject(err);
      });
    return d.promise;
  }



/***************** Data Set Functionality *****************/

  /*
   * GET:     List of data sets for active project
   * RETURN:  Array of dataset identifiers
   */
  var listDataSets = function() {
    var d = Q.defer();
    var returnList = [];

    _request('GET', GDC_API_DATASETS)
      .then(function(dataSets) {
        dataSets.dataSetsInfo.sets.forEach(function(dataSet) {
          returnList.push(dataSet.meta.identifier);
        });
        d.resolve(returnList);
      }, function(err) {
        d.reject(err);
      });
    return d.promise;
  }


  /*
   * GET:     object definition and meta data
   * PARAM:   identifier for object
   * RETURN:  JSON object containing data
   */
  var getObject = function(identifier) {
    var d = Q.defer();

    var json = {
      'identifierToUri': identifier
    }

    _request('POST', GDC_API_ID_TO_URI, json)
      .then(function(body) {
        _request('GET', body.identifiers[0].uri)
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
   * GET:     instance of GdcDataSet
   * PARAM:   identifier of dataset
   * RETURN:  object GdcDataSet
   */
  var getDataSet = function(identifier) {
    return new GdcDataSet(this, identifier);
  }



/***************** Expose/Export Functionality *****************/

  /*
   * Expose public API calls
   */
  this.version        = package_json.version;
  this.login          = login;

  this.projectInfo    = projectInfo;
  this.listProjects   = listProjects;

  this.listDataSets   = listDataSets;
  this.getObject      = getObject;
  this.getDataSet     = getDataSet;


  /*
   * Expose URL endpoints and request function for GdcDataSet
   */

  this.GDC_API_SLI    = GDC_API_SLI;
  this.GDC_API_ETL    = GDC_API_ETL;
  this.GDC_DI_SERVER  = GDC_DI_SERVER;

  this.__request      = _request;
  this.__download     = _download;
  this.__user         = {email: email, password: password, project: project}

  return this;
};

module.exports = gdc;
