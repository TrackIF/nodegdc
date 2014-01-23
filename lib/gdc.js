"use strict";

var package_json    = require('./../package.json');
var ftp             = require('ftp');
var zip             = require('node-zip');
var _               = require('lodash');
var request         = require('request');
var gdc = function(email, password, project) {

  if( !(this instanceof gdc) ) {
    return new gdc(email, password, project);
  }

  var _this         = this;

  /*
   * Expose public API calls
   */
  this.version         = package_json.version;
  return this;
};

module.exports = gdc;
