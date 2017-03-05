const getCompositeDetails = require('./utils/get-composite-details');
const getFileDetails = require('./utils/get-file-details');
const filterFiles = require('./utils/filter-files');
const errors = require('./errors');

/**
 * @typedef {Object} ManifestEntry
 * @property {String} url The URL to the asset in the manifest.
 * @property {String} revision The revision details for the file. This is a
 * hash generated by node based on the file contents.
 * @memberof module:sw-build
 */


/**
 * To get a list of files and revision details that can be used to ultimately
 * precache assets in a service worker.
 *
 * @param {Object} input
 * @param {Array<String>} input.globPatterns  Patterns used to select files to
 * include in the file entries.
 * @param {Array<String>} input.globIgnores  Patterns used to exclude files
 * from the file entries.
 * @param {String} input.rootDirectory The directory run the glob patterns over.
 * @return {Array<ManifestEntry>} An array of ManifestEntries will include
 * a url and revision details for each file found.
 * @memberof module:sw-build
 */
const getFileManifestEntries = (input) => {
  if (!input || typeof input !== 'object' || input instanceof Array) {
    throw new Error(errors['invalid-get-manifest-entries-input']);
  }

  const globPatterns = input.globPatterns;
  const globIgnores = input.globIgnores;
  const rootDirectory = input.rootDirectory;
  const serverRenderedUrls = input.serverRenderedUrls;

  if (typeof rootDirectory !== 'string' || rootDirectory.length === 0) {
    return Promise.reject(
      new Error(errors['invalid-root-directory']));
  }

  if (!globPatterns || !Array.isArray(globPatterns)) {
    return Promise.reject(
      new Error(errors['invalid-glob-patterns']));
  }

  const fileSet = new Set();

  const fileDetails = globPatterns.reduce((accumulated, globPattern) => {
    const globbedFileDetails = getFileDetails(
      rootDirectory, globPattern, globIgnores);
    globbedFileDetails.forEach((fileDetails) => {
      if (fileSet.has(fileDetails.file)) {
        return;
      }

      fileSet.add(fileDetails.file);
      accumulated.push(fileDetails);
    });
    return accumulated;
  }, []);

  // serverRenderedUrls is optional.
  if (serverRenderedUrls) {
    if (typeof serverRenderedUrls !== 'object') {
      return Promise.reject(new Error(errors['invalid-server-rendered-urls']));
    }

    for (let url of Object.keys(serverRenderedUrls)) {
      if (fileSet.has(url)) {
        return Promise.reject(
          new Error(errors['server-rendered-url-matches-glob']));
      }

      const dependencyGlobs = serverRenderedUrls[url];
      if (!Array.isArray(dependencyGlobs)) {
        return Promise.reject(
          new Error(errors['invalid-server-rendered-urls']));
      }

      const dependencyDetails = dependencyGlobs.reduce((previous, pattern) => {
        const globbedFileDetails = getFileDetails(
          rootDirectory, pattern, globIgnores);
        return previous.concat(globbedFileDetails);
      }, []);

      fileDetails.push(getCompositeDetails(url, dependencyDetails));
    }
  }

  return filterFiles(fileDetails);
};

module.exports = getFileManifestEntries;
