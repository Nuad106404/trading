/**
 * exFAT compatibility shim.
 *
 * On exFAT drives, readlink() on a regular file fails with EISDIR instead of
 * EINVAL (what NTFS/ext4 return for "not a symlink"). Next.js' output file
 * tracing (@vercel/nft) only tolerates EINVAL/ENOENT/UNKNOWN and treats
 * EISDIR as fatal, so production builds crash on exFAT.
 *
 * This remaps EISDIR readlink errors to EINVAL — semantically identical for
 * every caller ("this path is not a symlink"). Loaded by next.config.mjs and
 * propagated to build workers via NODE_OPTIONS.
 */
const fs = require("fs");

const remap = (err) => {
  if (err && err.code === "EISDIR" && err.syscall === "readlink") {
    err.code = "EINVAL";
  }
  return err;
};

const origReadlink = fs.readlink;
fs.readlink = function readlink(path, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  return origReadlink.call(fs, path, options, (err, link) => callback(remap(err), link));
};

const origReadlinkSync = fs.readlinkSync;
fs.readlinkSync = function readlinkSync(...args) {
  try {
    return origReadlinkSync.apply(fs, args);
  } catch (err) {
    throw remap(err);
  }
};

const origPromisesReadlink = fs.promises.readlink;
fs.promises.readlink = async function readlink(...args) {
  try {
    return await origPromisesReadlink.apply(fs.promises, args);
  } catch (err) {
    throw remap(err);
  }
};
