# nodegdc

This nodejs module to access GoodData REST API.

Based on logic in https://github.com/byrot/phpgdc


## Installation

The following recommended installation requires [npm](https://npmjs.org/). If you are unfamiliar with npm, see the [npm docs](https://npmjs.org/doc/). Npm comes installed with Node.js since node version 0.8.x therefore you likely already have it.

Add the following to your `package.json` file:

```json
{
  ...
  "dependencies": {
    ...
    "gdc": "0.0.1"
  }
}
```

Install nodcgec and its dependencies:

```bash
npm install
```

## Sample Code
```javascript
var gdc = require('../nodegdc')('name@example.com', 'gooddatapassword', 'project-code', true)

var testData = []
testData.push({'d_domains_name.nm_name': 'Company A', 'f_domains.dt_createddate_id': '2014-01-20', 'f_domains.nm_domain_url': 'company-a.com'});
testData.push({'d_domains_name.nm_name': 'Company B', 'f_domains.dt_createddate_id': '2014-01-21', 'f_domains.nm_domain_url': 'company-b.com'});
testData.push({'d_domains_name.nm_name': 'Company C', 'f_domains.dt_createddate_id': '2014-01-22', 'f_domains.nm_domain_url': 'company-c.com'});
testData.push({'d_domains_name.nm_name': 'Company D', 'f_domains.dt_createddate_id': '2014-01-23', 'f_domains.nm_domain_url': 'company-d.com'});

var constraints = { 'f_domains.dt_createddate_id': {'date': 'yyyy-MM-dd'}};

var dataSet;
gdc.login().then(function() {
  dataSet = gdc.getDataSet('dataset.domains');
  return dataSet.downloadConfig();
}).then(function() {
  dataSet.adjustManifest({constraints: constraints, mode: 'FULL'});
  return dataSet.prepareUpload(testData);
}).then(function() {
  return dataSet.doETL();
}).then(function(success) { console.log(success); }, function(err) { console.log(err);});
```

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Added some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

## License

Licensed under the MIT License.

