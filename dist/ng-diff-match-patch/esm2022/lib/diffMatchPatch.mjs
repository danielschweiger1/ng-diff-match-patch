/**
 * Class containing the diff, match and patch methods.

 */
class DiffMatchPatch {
    constructor() {
        // Defaults.
        // Redefine these in your program to override the defaults.
        // Number of seconds to map a diff before giving up (0 for infinity).
        this.Diff_Timeout = 1.0;
        // Cost of an empty edit operation in terms of edit characters.
        this.Diff_EditCost = 4;
        // At what point is no match declared (0.0 = perfection, 1.0 = very loose).
        this.Match_Threshold = 0.5;
        // How far to search for a match (0 = exact location, 1000+ = broad match).
        // A match this many characters away from the expected location will add
        // 1.0 to the score (0.0 is a perfect match).
        this.Match_Distance = 1000;
        // When deleting a large block of text (over ~64 characters), how close do
        // the contents have to be to match the expected contents. (0.0 = perfection,
        // 1.0 = very loose).  Note that Match_Threshold controls how closely the
        // end points of a delete need to match.
        this.Patch_DeleteThreshold = 0.5;
        // Chunk size for context length.
        this.Patch_Margin = 4;
        // The number of bits in an int.
        this.Match_MaxBits = 32;
        /**
         * The data structure representing a diff is an array of tuples:
         * [[DiffOp.Delete, 'Hello'], [DiffOp.Insert, 'Goodbye'], [DiffOp.Equal, ' world.']]
         * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
         */
        // Define some regex patterns for matching boundaries.
        this.whitespaceRegex_ = new RegExp('/\s/');
        this.linebreakRegex_ = new RegExp('/[\r\n]/');
        this.blanklineEndRegex_ = new RegExp('/\n\r?\n$/');
        this.blanklineStartRegex_ = new RegExp('/^\r?\n\r?\n/');
        /**
         * Convert a diff array into a pretty HTML report.
         * @param  diffs Array of diff tuples.
         * @return  HTML representation.
         */
        this.diff_prettyHtml = function (diffs) {
            const html = [];
            const pattern_amp = /&/g;
            const pattern_lt = /</g;
            const pattern_gt = />/g;
            const pattern_para = /\n/g;
            for (let x = 0; x < diffs.length; x++) {
                const op = diffs[x][0]; // Operation (insert, delete, equal)
                const data = diffs[x][1]; // Text of change.
                const text = data.replace(pattern_amp, '&amp;').replace(pattern_lt, '&lt;')
                    .replace(pattern_gt, '&gt;').replace(pattern_para, '&para;<br>');
                switch (op) {
                    case 1 /* DiffOp.Insert */:
                        html[x] = '<ins style="background:#e6ffe6;">' + text + '</ins>';
                        break;
                    case -1 /* DiffOp.Delete */:
                        html[x] = '<del style="background:#ffe6e6;">' + text + '</del>';
                        break;
                    case 0 /* DiffOp.Equal */:
                        html[x] = '<span>' + text + '</span>';
                        break;
                }
            }
            return html.join('');
        };
        /**
         * Look through the patches and break up any which are longer than the maximum
         * limit of the match algorithm.
         * Intended to be called only from within patch_apply.
         * @param  patches Array of Patch objects.
         */
        this.patch_splitMax = function (patches) {
            const patch_size = this.Match_MaxBits;
            for (let x = 0; x < patches.length; x++) {
                if (patches[x].length1 <= patch_size) {
                    continue;
                }
                const bigpatch = patches[x];
                // Remove the big old patch.
                patches.splice(x--, 1);
                let start1 = bigpatch.start1;
                let start2 = bigpatch.start2;
                let precontext = '';
                while (bigpatch.diffs.length !== 0) {
                    // Create one of several smaller patches.
                    const patch = new patch_obj();
                    let empty = true;
                    patch.start1 = start1 - precontext.length;
                    patch.start2 = start2 - precontext.length;
                    if (precontext !== '') {
                        patch.length1 = patch.length2 = precontext.length;
                        patch.diffs.push([0 /* DiffOp.Equal */, precontext]);
                    }
                    while (bigpatch.diffs.length !== 0 &&
                        patch.length1 < patch_size - this.Patch_Margin) {
                        const diff_type = bigpatch.diffs[0][0];
                        let diff_text = bigpatch.diffs[0][1];
                        if (diff_type === 1 /* DiffOp.Insert */) {
                            // Insertions are harmless.
                            patch.length2 += diff_text.length;
                            start2 += diff_text.length;
                            patch.diffs.push(bigpatch.diffs.shift());
                            empty = false;
                        }
                        else if (diff_type === -1 /* DiffOp.Delete */ && patch.diffs.length == 1 &&
                            patch.diffs[0][0] == 0 /* DiffOp.Equal */ &&
                            diff_text.length > 2 * patch_size) {
                            // This is a large deletion.  Let it pass in one chunk.
                            patch.length1 += diff_text.length;
                            start1 += diff_text.length;
                            empty = false;
                            patch.diffs.push([diff_type, diff_text]);
                            bigpatch.diffs.shift();
                        }
                        else {
                            // Deletion or equality.  Only take as much as we can stomach.
                            diff_text = diff_text.substring(0, patch_size - patch.length1 - this.Patch_Margin);
                            patch.length1 += diff_text.length;
                            start1 += diff_text.length;
                            if (diff_type === 0 /* DiffOp.Equal */) {
                                patch.length2 += diff_text.length;
                                start2 += diff_text.length;
                            }
                            else {
                                empty = false;
                            }
                            patch.diffs.push([diff_type, diff_text]);
                            if (diff_text == bigpatch.diffs[0][1]) {
                                bigpatch.diffs.shift();
                            }
                            else {
                                bigpatch.diffs[0][1] =
                                    bigpatch.diffs[0][1].substring(diff_text.length);
                            }
                        }
                    }
                    // Compute the head context for the next patch.
                    precontext = this.diff_text2(patch.diffs);
                    precontext =
                        precontext.substring(precontext.length - this.Patch_Margin);
                    // Append the end context for this patch.
                    const postcontext = this.diff_text1(bigpatch.diffs)
                        .substring(0, this.Patch_Margin);
                    if (postcontext !== '') {
                        patch.length1 += postcontext.length;
                        patch.length2 += postcontext.length;
                        if (patch.diffs.length !== 0 &&
                            patch.diffs[patch.diffs.length - 1][0] === 0 /* DiffOp.Equal */) {
                            patch.diffs[patch.diffs.length - 1][1] += postcontext;
                        }
                        else {
                            patch.diffs.push([0 /* DiffOp.Equal */, postcontext]);
                        }
                    }
                    if (!empty) {
                        patches.splice(++x, 0, patch);
                    }
                }
            }
        };
    }
    /**
     * Find the differences between two texts.  Simplifies the problem by stripping
     * any common prefix or suffix off the texts before diffing.
     * @param  text1 Old string to be diffed.
     * @param  text2 New string to be diffed.
     * @param  opt_checklines Optional speedup flag. If present and false,
     *     then don't run a line-level diff first to identify the changed areas.
     *     Defaults to true, which does a faster, slightly less optimal diff.
     * @param  opt_deadline Optional time when the diff should be complete
     *     by.  Used internally for recursive calls.  Users should set DiffTimeout
     *     instead.
     * @return  Array of diff tuples.
     */
    diff_main(text1, text2, opt_checklines, opt_deadline) {
        // Set a deadline by which time the diff must be complete.
        if (typeof opt_deadline == 'undefined') {
            if (this.Diff_Timeout <= 0) {
                opt_deadline = Number.MAX_VALUE;
            }
            else {
                opt_deadline = (new Date).getTime() + this.Diff_Timeout * 1000;
            }
        }
        const deadline = opt_deadline;
        // Check for null inputs.
        if (text1 == null || text2 == null) {
            throw new Error('Null input. (diff_main)');
        }
        // Check for equality (speedup).
        if (text1 == text2) {
            if (text1) {
                return [[0 /* DiffOp.Equal */, text1]];
            }
            return [];
        }
        if (typeof opt_checklines == 'undefined') {
            opt_checklines = true;
        }
        const checklines = opt_checklines;
        // Trim off common prefix (speedup).
        let commonlength = this.diff_commonPrefix(text1, text2);
        const commonprefix = text1.substring(0, commonlength);
        text1 = text1.substring(commonlength);
        text2 = text2.substring(commonlength);
        // Trim off common suffix (speedup).
        commonlength = this.diff_commonSuffix(text1, text2);
        const commonsuffix = text1.substring(text1.length - commonlength);
        text1 = text1.substring(0, text1.length - commonlength);
        text2 = text2.substring(0, text2.length - commonlength);
        // Compute the diff on the middle block.
        const diffs = this.diff_compute_(text1, text2, checklines, deadline);
        // Restore the prefix and suffix.
        if (commonprefix) {
            diffs.unshift([0 /* DiffOp.Equal */, commonprefix]);
        }
        if (commonsuffix) {
            diffs.push([0 /* DiffOp.Equal */, commonsuffix]);
        }
        this.diff_cleanupMerge(diffs);
        return diffs;
    }
    ;
    /**
     * Find the differences between two texts.  Assumes that the texts do not
     * have any common prefix or suffix.
     * @param  text1 Old string to be diffed.
     * @param  text2 New string to be diffed.
     * @param  checklines Speedup flag.  If false, then don't run a
     *     line-level diff first to identify the changed areas.
     *     If true, then run a faster, slightly less optimal diff.
     * @param  deadline Time when the diff should be complete by.
     * @return  Array of diff tuples.
  
     */
    diff_compute_(text1, text2, checklines, deadline) {
        let diffs;
        if (!text1) {
            // Just add some text (speedup).
            return [[1 /* DiffOp.Insert */, text2]];
        }
        if (!text2) {
            // Just delete some text (speedup).
            return [[-1 /* DiffOp.Delete */, text1]];
        }
        const longtext = text1.length > text2.length ? text1 : text2;
        const shorttext = text1.length > text2.length ? text2 : text1;
        const i = longtext.indexOf(shorttext);
        if (i != -1) {
            // Shorter text is inside the longer text (speedup).
            diffs = [[1 /* DiffOp.Insert */, longtext.substring(0, i)],
                [0 /* DiffOp.Equal */, shorttext],
                [1 /* DiffOp.Insert */, longtext.substring(i + shorttext.length)]];
            // Swap insertions for deletions if diff is reversed.
            if (text1.length > text2.length) {
                diffs[0][0] = diffs[2][0] = -1 /* DiffOp.Delete */;
            }
            return diffs;
        }
        if (shorttext.length == 1) {
            // Single character string.
            // After the previous speedup, the character can't be an equality.
            return [[-1 /* DiffOp.Delete */, text1], [1 /* DiffOp.Insert */, text2]];
        }
        // Check to see if the problem can be split in two.
        const hm = this.diff_halfMatch_(text1, text2);
        if (hm) {
            // A half-match was found, sort out the return data.
            const text1_a = hm[0];
            const text1_b = hm[1];
            const text2_a = hm[2];
            const text2_b = hm[3];
            const mid_common = hm[4];
            // Send both pairs off for separate processing.
            const diffs_a = this.diff_main(text1_a, text2_a, checklines, deadline);
            const diffs_b = this.diff_main(text1_b, text2_b, checklines, deadline);
            // Merge the results.
            return diffs_a.concat([[0 /* DiffOp.Equal */, mid_common]], diffs_b);
        }
        if (checklines && text1.length > 100 && text2.length > 100) {
            return this.diff_lineMode_(text1, text2, deadline);
        }
        return this.diff_bisect_(text1, text2, deadline);
    }
    ;
    /**
     * Do a quick line-level diff on both strings, then rediff the parts for
     * greater accuracy.
     * This speedup can produce non-minimal diffs.
     * @param  text1 Old string to be diffed.
     * @param  text2 New string to be diffed.
     * @param  deadline Time when the diff should be complete by.
     * @return  Array of diff tuples.
  
     */
    diff_lineMode_(text1, text2, deadline) {
        // Scan the text on a line-by-line basis first.
        const a = this.diff_linesToChars_(text1, text2);
        text1 = a.chars1;
        text2 = a.chars2;
        const linearray = a.lineArray;
        const diffs = this.diff_main(text1, text2, false, deadline);
        // Convert the diff back to original text.
        this.diff_charsToLines_(diffs, linearray);
        // Eliminate freak matches (e.g. blank lines)
        this.diff_cleanupSemantic(diffs);
        // Rediff any replacement blocks, this time character-by-character.
        // Add a dummy entry at the end.
        diffs.push([0 /* DiffOp.Equal */, '']);
        let pointer = 0;
        let count_delete = 0;
        let count_insert = 0;
        let text_delete = '';
        let text_insert = '';
        while (pointer < diffs.length) {
            switch (diffs[pointer][0]) {
                case 1 /* DiffOp.Insert */:
                    count_insert++;
                    text_insert += diffs[pointer][1];
                    break;
                case -1 /* DiffOp.Delete */:
                    count_delete++;
                    text_delete += diffs[pointer][1];
                    break;
                case 0 /* DiffOp.Equal */:
                    // Upon reaching an equality, check for prior redundancies.
                    if (count_delete >= 1 && count_insert >= 1) {
                        // Delete the offending records and add the merged ones.
                        diffs.splice(pointer - count_delete - count_insert, count_delete + count_insert);
                        pointer = pointer - count_delete - count_insert;
                        const b = this.diff_main(text_delete, text_insert, false, deadline);
                        for (let j = b.length - 1; j >= 0; j--) {
                            diffs.splice(pointer, 0, b[j]);
                        }
                        pointer = pointer + b.length;
                    }
                    count_insert = 0;
                    count_delete = 0;
                    text_delete = '';
                    text_insert = '';
                    break;
            }
            pointer++;
        }
        diffs.pop(); // Remove the dummy entry at the end.
        return diffs;
    }
    ;
    /**
     * Find the 'middle snake' of a diff, split the problem in two
     * and return the recursively constructed diff.
     * See Myers 1986 paper: An O(ND) Difference Algorithm and Its constiations.
     * @param  text1 Old string to be diffed.
     * @param  text2 New string to be diffed.
     * @param  deadline Time at which to bail if not yet complete.
     * @return  Array of diff tuples.
  
     */
    diff_bisect_(text1, text2, deadline) {
        // Cache the text lengths to prevent multiple calls.
        const text1_length = text1.length;
        const text2_length = text2.length;
        const max_d = Math.ceil((text1_length + text2_length) / 2);
        const v_offset = max_d;
        const v_length = 2 * max_d;
        const v1 = new Array(v_length);
        const v2 = new Array(v_length);
        // Setting all elements to -1 is faster in Chrome & Firefox than mixing
        // integers and undefined.
        for (let x = 0; x < v_length; x++) {
            v1[x] = -1;
            v2[x] = -1;
        }
        v1[v_offset + 1] = 0;
        v2[v_offset + 1] = 0;
        const delta = text1_length - text2_length;
        // If the total number of characters is odd, then the front path will collide
        // with the reverse path.
        const front = (delta % 2 != 0);
        // Offsets for start and end of k loop.
        // Prevents mapping of space beyond the grid.
        let k1start = 0;
        let k1end = 0;
        let k2start = 0;
        let k2end = 0;
        for (let d = 0; d < max_d; d++) {
            // Bail out if deadline is reached.
            if ((new Date()).getTime() > deadline) {
                break;
            }
            // Walk the front path one step.
            for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
                const k1_offset = v_offset + k1;
                let x1;
                if (k1 == -d || (k1 != d && v1[k1_offset - 1] < v1[k1_offset + 1])) {
                    x1 = v1[k1_offset + 1];
                }
                else {
                    x1 = v1[k1_offset - 1] + 1;
                }
                let y1 = x1 - k1;
                while (x1 < text1_length && y1 < text2_length &&
                    text1.charAt(x1) == text2.charAt(y1)) {
                    x1++;
                    y1++;
                }
                v1[k1_offset] = x1;
                if (x1 > text1_length) {
                    // Ran off the right of the graph.
                    k1end += 2;
                }
                else if (y1 > text2_length) {
                    // Ran off the bottom of the graph.
                    k1start += 2;
                }
                else if (front) {
                    const k2_offset = v_offset + delta - k1;
                    if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] != -1) {
                        // Mirror x2 onto top-left coordinate system.
                        const x2 = text1_length - v2[k2_offset];
                        if (x1 >= x2) {
                            // Overlap detected.
                            return this.diff_bisectSplit_(text1, text2, x1, y1, deadline);
                        }
                    }
                }
            }
            // Walk the reverse path one step.
            for (let k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
                const k2_offset = v_offset + k2;
                let x2;
                if (k2 == -d || (k2 != d && v2[k2_offset - 1] < v2[k2_offset + 1])) {
                    x2 = v2[k2_offset + 1];
                }
                else {
                    x2 = v2[k2_offset - 1] + 1;
                }
                let y2 = x2 - k2;
                while (x2 < text1_length && y2 < text2_length &&
                    text1.charAt(text1_length - x2 - 1) ==
                        text2.charAt(text2_length - y2 - 1)) {
                    x2++;
                    y2++;
                }
                v2[k2_offset] = x2;
                if (x2 > text1_length) {
                    // Ran off the left of the graph.
                    k2end += 2;
                }
                else if (y2 > text2_length) {
                    // Ran off the top of the graph.
                    k2start += 2;
                }
                else if (!front) {
                    const k1_offset = v_offset + delta - k2;
                    if (k1_offset >= 0 && k1_offset < v_length && v1[k1_offset] != -1) {
                        const x1 = v1[k1_offset];
                        const y1 = v_offset + x1 - k1_offset;
                        // Mirror x2 onto top-left coordinate system.
                        x2 = text1_length - x2;
                        if (x1 >= x2) {
                            // Overlap detected.
                            return this.diff_bisectSplit_(text1, text2, x1, y1, deadline);
                        }
                    }
                }
            }
        }
        // Diff took too long and hit the deadline or
        // number of diffs equals number of characters, no commonality at all.
        return [[-1 /* DiffOp.Delete */, text1], [1 /* DiffOp.Insert */, text2]];
    }
    ;
    /**
     * Given the location of the 'middle snake', split the diff in two parts
     * and recurse.
     * @param  text1 Old string to be diffed.
     * @param  text2 New string to be diffed.
     * @param  x Index of split point in text1.
     * @param  y Index of split point in text2.
     * @param  deadline Time at which to bail if not yet complete.
     * @return  Array of diff tuples.
  
     */
    diff_bisectSplit_(text1, text2, x, y, deadline) {
        const text1a = text1.substring(0, x);
        const text2a = text2.substring(0, y);
        const text1b = text1.substring(x);
        const text2b = text2.substring(y);
        // Compute both diffs serially.
        const diffs = this.diff_main(text1a, text2a, false, deadline);
        const diffsb = this.diff_main(text1b, text2b, false, deadline);
        return diffs.concat(diffsb);
    }
    ;
    /**
     * Split two texts into an array of strings.  Reduce the texts to a string of
     * hashes where each Unicode character represents one line.
     * @param  text1 First string.
     * @param  text2 Second string.
     * @return }
     *     An object containing the encoded text1, the encoded text2 and
     *     the array of unique strings.
     *     The zeroth element of the array of unique strings is intentionally blank.
  
     */
    diff_linesToChars_(text1, text2) {
        const lineArray = []; // e.g. lineArray[4] == 'Hello\n'
        const lineHash = {}; // e.g. lineHash['Hello\n'] == 4
        // '\x00' is a valid character, but constious debuggers don't like it.
        // So we'll insert a junk entry to avoid generating a null character.
        lineArray[0] = '';
        const chars1 = this.diff_linesToCharsMunge_(text1, lineArray, lineHash);
        const chars2 = this.diff_linesToCharsMunge_(text2, lineArray, lineHash);
        return { chars1: chars1, chars2: chars2, lineArray: lineArray };
    }
    ;
    /**
     * Split a text into an array of strings.  Reduce the texts to a string of
     * hashes where each Unicode character represents one line.
     * Modifies linearray and linehash through being a closure.
     * @param  text String to encode.
     * @return  Encoded string.
  
     */
    diff_linesToCharsMunge_(text, lineArray, lineHash) {
        let chars = '';
        // Walk the text, pulling out a substring for each line.
        // text.split('\n') would would temporarily double our memory footprint.
        // Modifying text would create many large strings to garbage collect.
        let lineStart = 0;
        let lineEnd = -1;
        // Keeping our own length constiable is faster than looking it up.
        let lineArrayLength = lineArray.length;
        while (lineEnd < text.length - 1) {
            lineEnd = text.indexOf('\n', lineStart);
            if (lineEnd == -1) {
                lineEnd = text.length - 1;
            }
            const line = text.substring(lineStart, lineEnd + 1);
            lineStart = lineEnd + 1;
            if (lineHash.hasOwnProperty ? lineHash.hasOwnProperty(line) :
                (lineHash[line] !== undefined)) {
                chars += String.fromCharCode(lineHash[line]);
            }
            else {
                chars += String.fromCharCode(lineArrayLength);
                lineHash[line] = lineArrayLength;
                lineArray[lineArrayLength++] = line;
            }
        }
        return chars;
    }
    /**
     * Rehydrate the text in a diff from a string of line hashes to real lines of
     * text.
     * @param  diffs Array of diff tuples.
     * @param  lineArray Array of unique strings.
  
     */
    diff_charsToLines_(diffs, lineArray) {
        for (let x = 0; x < diffs.length; x++) {
            const chars = diffs[x][1];
            const text = [];
            for (let y = 0; y < chars.length; y++) {
                text[y] = lineArray[chars.charCodeAt(y)];
            }
            diffs[x][1] = text.join('');
        }
    }
    ;
    /**
     * Determine the common prefix of two strings.
     * @param  text1 First string.
     * @param  text2 Second string.
     * @return  The number of characters common to the start of each
     *     string.
     */
    diff_commonPrefix(text1, text2) {
        // Quick check for common null cases.
        if (!text1 || !text2 || text1.charAt(0) != text2.charAt(0)) {
            return 0;
        }
        // Binary search.
        // Performance analysis: http://neil.fraser.name/news/2007/10/09/
        let pointermin = 0;
        let pointermax = Math.min(text1.length, text2.length);
        let pointermid = pointermax;
        let pointerstart = 0;
        while (pointermin < pointermid) {
            if (text1.substring(pointerstart, pointermid) ==
                text2.substring(pointerstart, pointermid)) {
                pointermin = pointermid;
                pointerstart = pointermin;
            }
            else {
                pointermax = pointermid;
            }
            pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
        }
        return pointermid;
    }
    ;
    /**
     * Determine the common suffix of two strings.
     * @param  text1 First string.
     * @param  text2 Second string.
     * @return  The number of characters common to the end of each string.
     */
    diff_commonSuffix(text1, text2) {
        // Quick check for common null cases.
        if (!text1 || !text2 ||
            text1.charAt(text1.length - 1) != text2.charAt(text2.length - 1)) {
            return 0;
        }
        // Binary search.
        // Performance analysis: http://neil.fraser.name/news/2007/10/09/
        let pointermin = 0;
        let pointermax = Math.min(text1.length, text2.length);
        let pointermid = pointermax;
        let pointerend = 0;
        while (pointermin < pointermid) {
            if (text1.substring(text1.length - pointermid, text1.length - pointerend) ==
                text2.substring(text2.length - pointermid, text2.length - pointerend)) {
                pointermin = pointermid;
                pointerend = pointermin;
            }
            else {
                pointermax = pointermid;
            }
            pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
        }
        return pointermid;
    }
    ;
    /**
     * Determine if the suffix of one string is the prefix of another.
     * @param  text1 First string.
     * @param  text2 Second string.
     * @return  The number of characters common to the end of the first
     *     string and the start of the second string.
  
     */
    diff_commonOverlap_(text1, text2) {
        // Cache the text lengths to prevent multiple calls.
        const text1_length = text1.length;
        const text2_length = text2.length;
        // Eliminate the null case.
        if (text1_length == 0 || text2_length == 0) {
            return 0;
        }
        // Truncate the longer string.
        if (text1_length > text2_length) {
            text1 = text1.substring(text1_length - text2_length);
        }
        else if (text1_length < text2_length) {
            text2 = text2.substring(0, text1_length);
        }
        const text_length = Math.min(text1_length, text2_length);
        // Quick check for the worst case.
        if (text1 == text2) {
            return text_length;
        }
        // Start by looking for a single character match
        // and increase length until no match is found.
        // Performance analysis: http://neil.fraser.name/news/2010/11/04/
        let best = 0;
        let length = 1;
        while (true) {
            const pattern = text1.substring(text_length - length);
            const found = text2.indexOf(pattern);
            if (found == -1) {
                return best;
            }
            length += found;
            if (found == 0 || text1.substring(text_length - length) ==
                text2.substring(0, length)) {
                best = length;
                length++;
            }
        }
    }
    ;
    /**
     * Do the two texts share a substring which is at least half the length of the
     * longer text?
     * This speedup can produce non-minimal diffs.
     * @param  text1 First string.
     * @param  text2 Second string.
     * @return  Five element Array, containing the prefix of
     *     text1, the suffix of text1, the prefix of text2, the suffix of
     *     text2 and the common middle.  Or null if there was no match.
  
     */
    diff_halfMatch_(text1, text2) {
        if (this.Diff_Timeout <= 0) {
            // Don't risk returning a non-optimal diff if we have unlimited time.
            return null;
        }
        const longtext = text1.length > text2.length ? text1 : text2;
        const shorttext = text1.length > text2.length ? text2 : text1;
        if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
            return null; // Pointless.
        }
        const dmp = this; // 'this' becomes 'window' in a closure.
        // First check if the second quarter is the seed for a half-match.
        const hm1 = this.diff_halfMatchI_(longtext, shorttext, Math.ceil(longtext.length / 4), dmp);
        // Check again based on the third quarter.
        const hm2 = this.diff_halfMatchI_(longtext, shorttext, Math.ceil(longtext.length / 2), dmp);
        let hm;
        if (!hm1 && !hm2) {
            return null;
        }
        else if (!hm2) {
            hm = hm1;
        }
        else if (!hm1) {
            hm = hm2;
        }
        else {
            // Both matched.  Select the longest.
            hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
        }
        // A half-match was found, sort out the return data.
        let text1_a, text1_b, text2_a, text2_b;
        if (text1.length > text2.length) {
            text1_a = hm[0];
            text1_b = hm[1];
            text2_a = hm[2];
            text2_b = hm[3];
        }
        else {
            text2_a = hm[0];
            text2_b = hm[1];
            text1_a = hm[2];
            text1_b = hm[3];
        }
        const mid_common = hm[4];
        return [text1_a, text1_b, text2_a, text2_b, mid_common];
    }
    ;
    /**
     * Does a substring of shorttext exist within longtext such that the substring
     * is at least half the length of longtext?
     * Closure, but does not reference any external constiables.
     * @param  longtext Longer string.
     * @param  shorttext Shorter string.
     * @param  i Start index of quarter length substring within longtext.
     * @return  Five element Array, containing the prefix of
     *     longtext, the suffix of longtext, the prefix of shorttext, the suffix
     *     of shorttext and the common middle.  Or null if there was no match.
  
     */
    diff_halfMatchI_(longtext, shorttext, i, dmp) {
        // Start with a 1/4 length substring at position i as a seed.
        const seed = longtext.substring(i, i + Math.floor(longtext.length / 4));
        let j = -1;
        let best_common = '';
        let best_longtext_a, best_longtext_b, best_shorttext_a, best_shorttext_b;
        while ((j = shorttext.indexOf(seed, j + 1)) != -1) {
            const prefixLength = dmp.diff_commonPrefix(longtext.substring(i), shorttext.substring(j));
            const suffixLength = dmp.diff_commonSuffix(longtext.substring(0, i), shorttext.substring(0, j));
            if (best_common.length < suffixLength + prefixLength) {
                best_common = shorttext.substring(j - suffixLength, j) +
                    shorttext.substring(j, j + prefixLength);
                best_longtext_a = longtext.substring(0, i - suffixLength);
                best_longtext_b = longtext.substring(i + prefixLength);
                best_shorttext_a = shorttext.substring(0, j - suffixLength);
                best_shorttext_b = shorttext.substring(j + prefixLength);
            }
        }
        if (best_common.length * 2 >= longtext.length) {
            return [best_longtext_a, best_longtext_b,
                best_shorttext_a, best_shorttext_b, best_common];
        }
        else {
            return null;
        }
    }
    /**
     * Reduce the number of edits by eliminating semantically trivial equalities.
     * @param  diffs Array of diff tuples.
     */
    diff_cleanupSemantic(diffs) {
        let changes = false;
        const equalities = []; // Stack of indices where equalities are found.
        let equalitiesLength = 0; // Keeping our own length const is faster in JS.
        let lastequality = null;
        // Always equal to diffs[equalities[equalitiesLength - 1]][1]
        let pointer = 0; // Index of current position.
        // Number of characters that changed prior to the equality.
        let length_insertions1 = 0;
        let length_deletions1 = 0;
        // Number of characters that changed after the equality.
        let length_insertions2 = 0;
        let length_deletions2 = 0;
        while (pointer < diffs.length) {
            if (diffs[pointer][0] == 0 /* DiffOp.Equal */) { // Equality found.
                equalities[equalitiesLength++] = pointer;
                length_insertions1 = length_insertions2;
                length_deletions1 = length_deletions2;
                length_insertions2 = 0;
                length_deletions2 = 0;
                lastequality = diffs[pointer][1];
            }
            else { // An insertion or deletion.
                if (diffs[pointer][0] == 1 /* DiffOp.Insert */) {
                    length_insertions2 += diffs[pointer][1].length;
                }
                else {
                    length_deletions2 += diffs[pointer][1].length;
                }
                // Eliminate an equality that is smaller or equal to the edits on both
                // sides of it.
                if (lastequality && (lastequality.length <=
                    Math.max(length_insertions1, length_deletions1)) &&
                    (lastequality.length <= Math.max(length_insertions2, length_deletions2))) {
                    // Duplicate record.
                    diffs.splice(equalities[equalitiesLength - 1], 0, [-1 /* DiffOp.Delete */, lastequality]);
                    // Change second copy to insert.
                    diffs[equalities[equalitiesLength - 1] + 1][0] = 1 /* DiffOp.Insert */;
                    // Throw away the equality we just deleted.
                    equalitiesLength--;
                    // Throw away the previous equality (it needs to be reevaluated).
                    equalitiesLength--;
                    pointer = equalitiesLength > 0 ? equalities[equalitiesLength - 1] : -1;
                    length_insertions1 = 0; // Reset the counters.
                    length_deletions1 = 0;
                    length_insertions2 = 0;
                    length_deletions2 = 0;
                    lastequality = null;
                    changes = true;
                }
            }
            pointer++;
        }
        // Normalize the diff.
        if (changes) {
            this.diff_cleanupMerge(diffs);
        }
        this.diff_cleanupSemanticLossless(diffs);
        // Find any overlaps between deletions and insertions.
        // e.g: <del>abcxxx</del><ins>xxxdef</ins>
        //   -> <del>abc</del>xxx<ins>def</ins>
        // e.g: <del>xxxabc</del><ins>defxxx</ins>
        //   -> <ins>def</ins>xxx<del>abc</del>
        // Only extract an overlap if it is as big as the edit ahead or behind it.
        pointer = 1;
        while (pointer < diffs.length) {
            if (diffs[pointer - 1][0] == -1 /* DiffOp.Delete */ &&
                diffs[pointer][0] == 1 /* DiffOp.Insert */) {
                const deletion = diffs[pointer - 1][1];
                const insertion = diffs[pointer][1];
                const overlap_length1 = this.diff_commonOverlap_(deletion, insertion);
                const overlap_length2 = this.diff_commonOverlap_(insertion, deletion);
                if (overlap_length1 >= overlap_length2) {
                    if (overlap_length1 >= deletion.length / 2 ||
                        overlap_length1 >= insertion.length / 2) {
                        // Overlap found.  Insert an equality and trim the surrounding edits.
                        diffs.splice(pointer, 0, [0 /* DiffOp.Equal */, insertion.substring(0, overlap_length1)]);
                        diffs[pointer - 1][1] =
                            deletion.substring(0, deletion.length - overlap_length1);
                        diffs[pointer + 1][1] = insertion.substring(overlap_length1);
                        pointer++;
                    }
                }
                else {
                    if (overlap_length2 >= deletion.length / 2 ||
                        overlap_length2 >= insertion.length / 2) {
                        // Reverse overlap found.
                        // Insert an equality and swap and trim the surrounding edits.
                        diffs.splice(pointer, 0, [0 /* DiffOp.Equal */, deletion.substring(0, overlap_length2)]);
                        diffs[pointer - 1][0] = 1 /* DiffOp.Insert */;
                        diffs[pointer - 1][1] =
                            insertion.substring(0, insertion.length - overlap_length2);
                        diffs[pointer + 1][0] = -1 /* DiffOp.Delete */;
                        diffs[pointer + 1][1] =
                            deletion.substring(overlap_length2);
                        pointer++;
                    }
                }
                pointer++;
            }
            pointer++;
        }
    }
    ;
    /**
     * Look for single edits surrounded on both sides by equalities
     * which can be shifted sideways to align the edit to a word boundary.
     * e.g: The c<ins>at c</ins>ame. -> The <ins>cat </ins>came.
     * @param  diffs Array of diff tuples.
     */
    diff_cleanupSemanticLossless(diffs) {
        /**
         * Given two strings, compute a score representing whether the internal
         * boundary falls on logical boundaries.
         * Scores range from 6 (best) to 0 (worst).
         * Closure, but does not reference any external constiables.
         * @param  one First string.
         * @param  two Second string.
         * @return  The score.
    
         */
        function diff_cleanupSemanticScore_(one, two) {
            if (!one || !two) {
                // Edges are the best.
                return 6;
            }
            const nonAlphaNumericRegex_ = new RegExp('/[^a-zA-Z0-9]/');
            // Each port of this function behaves slightly differently due to
            // subtle differences in each language's definition of things like
            // 'whitespace'.  Since this function's purpose is largely cosmetic,
            // the choice has been made to use each language's native features
            // rather than force total conformity.
            const char1 = one.charAt(one.length - 1);
            const char2 = two.charAt(0);
            const nonAlphaNumeric1 = char1.match(nonAlphaNumericRegex_);
            const nonAlphaNumeric2 = char2.match(nonAlphaNumericRegex_);
            const whitespace1 = nonAlphaNumeric1 &&
                char1.match(this.whitespaceRegex_);
            const whitespace2 = nonAlphaNumeric2 &&
                char2.match(this.whitespaceRegex_);
            const lineBreak1 = whitespace1 &&
                char1.match(this.linebreakRegex_);
            const lineBreak2 = whitespace2 &&
                char2.match(this.linebreakRegex_);
            const blankLine1 = lineBreak1 &&
                one.match(this.blanklineEndRegex_);
            const blankLine2 = lineBreak2 &&
                two.match(this.blanklineStartRegex_);
            if (blankLine1 || blankLine2) {
                // Five points for blank lines.
                return 5;
            }
            else if (lineBreak1 || lineBreak2) {
                // Four points for line breaks.
                return 4;
            }
            else if (nonAlphaNumeric1 && !whitespace1 && whitespace2) {
                // Three points for end of sentences.
                return 3;
            }
            else if (whitespace1 || whitespace2) {
                // Two points for whitespace.
                return 2;
            }
            else if (nonAlphaNumeric1 || nonAlphaNumeric2) {
                // One point for non-alphanumeric.
                return 1;
            }
            return 0;
        }
        let pointer = 1;
        // Intentionally ignore the first and last element (don't need checking).
        while (pointer < diffs.length - 1) {
            if (diffs[pointer - 1][0] == 0 /* DiffOp.Equal */ &&
                diffs[pointer + 1][0] == 0 /* DiffOp.Equal */) {
                // This is a single edit surrounded by equalities.
                let equality1 = diffs[pointer - 1][1];
                let edit = diffs[pointer][1];
                let equality2 = diffs[pointer + 1][1];
                // First, shift the edit as far left as possible.
                const commonOffset = this.diff_commonSuffix(equality1, edit);
                if (commonOffset) {
                    const commonString = edit.substring(edit.length - commonOffset);
                    equality1 = equality1.substring(0, equality1.length - commonOffset);
                    edit = commonString + edit.substring(0, edit.length - commonOffset);
                    equality2 = commonString + equality2;
                }
                // Second, step character by character right, looking for the best fit.
                let bestEquality1 = equality1;
                let bestEdit = edit;
                let bestEquality2 = equality2;
                let bestScore = diff_cleanupSemanticScore_(equality1, edit) +
                    diff_cleanupSemanticScore_(edit, equality2);
                while (edit.charAt(0) === equality2.charAt(0)) {
                    equality1 += edit.charAt(0);
                    edit = edit.substring(1) + equality2.charAt(0);
                    equality2 = equality2.substring(1);
                    const score = diff_cleanupSemanticScore_(equality1, edit) +
                        diff_cleanupSemanticScore_(edit, equality2);
                    // The >= encourages trailing rather than leading whitespace on edits.
                    if (score >= bestScore) {
                        bestScore = score;
                        bestEquality1 = equality1;
                        bestEdit = edit;
                        bestEquality2 = equality2;
                    }
                }
                if (diffs[pointer - 1][1] != bestEquality1) {
                    // We have an improvement, save it back to the diff.
                    if (bestEquality1) {
                        diffs[pointer - 1][1] = bestEquality1;
                    }
                    else {
                        diffs.splice(pointer - 1, 1);
                        pointer--;
                    }
                    diffs[pointer][1] = bestEdit;
                    if (bestEquality2) {
                        diffs[pointer + 1][1] = bestEquality2;
                    }
                    else {
                        diffs.splice(pointer + 1, 1);
                        pointer--;
                    }
                }
            }
            pointer++;
        }
    }
    ;
    /**
     * Reduce the number of edits by eliminating operationally trivial equalities.
     * @param  diffs Array of diff tuples.
     */
    diff_cleanupEfficiency(diffs) {
        let changes = false;
        const equalities = []; // Stack of indices where equalities are found.
        let equalitiesLength = 0; // Keeping our own length const is faster in JS.
        let lastequality = null;
        // Always equal to diffs[equalities[equalitiesLength - 1]][1]
        let pointer = 0; // Index of current position.
        // Is there an insertion operation before the last equality.
        let pre_ins = false;
        // Is there a deletion operation before the last equality.
        let pre_del = false;
        // Is there an insertion operation after the last equality.
        let post_ins = false;
        // Is there a deletion operation after the last equality.
        let post_del = false;
        while (pointer < diffs.length) {
            if (diffs[pointer][0] == 0 /* DiffOp.Equal */) { // Equality found.
                if (diffs[pointer][1].length < this.Diff_EditCost &&
                    (post_ins || post_del)) {
                    // Candidate found.
                    equalities[equalitiesLength++] = pointer;
                    pre_ins = post_ins;
                    pre_del = post_del;
                    lastequality = diffs[pointer][1];
                }
                else {
                    // Not a candidate, and can never become one.
                    equalitiesLength = 0;
                    lastequality = null;
                }
                post_ins = post_del = false;
            }
            else { // An insertion or deletion.
                if (diffs[pointer][0] == -1 /* DiffOp.Delete */) {
                    post_del = true;
                }
                else {
                    post_ins = true;
                }
                /*
                * Five types to be split:
                * <ins>A</ins><del>B</del>XY<ins>C</ins><del>D</del>
                * <ins>A</ins>X<ins>C</ins><del>D</del>
                * <ins>A</ins><del>B</del>X<ins>C</ins>
                * <ins>A</del>X<ins>C</ins><del>D</del>
                * <ins>A</ins><del>B</del>X<del>C</del>
                */
                if (lastequality && ((pre_ins && pre_del && post_ins && post_del) ||
                    ((lastequality.length < this.Diff_EditCost / 2) &&
                        ((pre_ins ? 1 : 0) + (pre_del ? 1 : 0) + (post_ins ? 1 : 0) + (post_del ? 1 : 0) == 3)))) {
                    // Duplicate record.
                    diffs.splice(equalities[equalitiesLength - 1], 0, [-1 /* DiffOp.Delete */, lastequality]);
                    // Change second copy to insert.
                    diffs[equalities[equalitiesLength - 1] + 1][0] = 1 /* DiffOp.Insert */;
                    equalitiesLength--; // Throw away the equality we just deleted;
                    lastequality = null;
                    if (pre_ins && pre_del) {
                        // No changes made which could affect previous entry, keep going.
                        post_ins = post_del = true;
                        equalitiesLength = 0;
                    }
                    else {
                        equalitiesLength--; // Throw away the previous equality.
                        pointer = equalitiesLength > 0 ?
                            equalities[equalitiesLength - 1] : -1;
                        post_ins = post_del = false;
                    }
                    changes = true;
                }
            }
            pointer++;
        }
        if (changes) {
            this.diff_cleanupMerge(diffs);
        }
    }
    ;
    /**
     * Reorder and merge like edit sections.  Merge equalities.
     * Any edit section can move as long as it doesn't cross an equality.
     * @param  diffs Array of diff tuples.
     */
    diff_cleanupMerge(diffs) {
        diffs.push([0 /* DiffOp.Equal */, '']); // Add a dummy entry at the end.
        let pointer = 0;
        let count_delete = 0;
        let count_insert = 0;
        let text_delete = '';
        let text_insert = '';
        let commonlength;
        while (pointer < diffs.length) {
            switch (diffs[pointer][0]) {
                case 1 /* DiffOp.Insert */:
                    count_insert++;
                    text_insert += diffs[pointer][1];
                    pointer++;
                    break;
                case -1 /* DiffOp.Delete */:
                    count_delete++;
                    text_delete += diffs[pointer][1];
                    pointer++;
                    break;
                case 0 /* DiffOp.Equal */:
                    // Upon reaching an equality, check for prior redundancies.
                    if (count_delete + count_insert > 1) {
                        if (count_delete !== 0 && count_insert !== 0) {
                            // Factor out any common prefixies.
                            commonlength = this.diff_commonPrefix(text_insert, text_delete);
                            if (commonlength !== 0) {
                                if ((pointer - count_delete - count_insert) > 0 &&
                                    diffs[pointer - count_delete - count_insert - 1][0] ==
                                        0 /* DiffOp.Equal */) {
                                    diffs[pointer - count_delete - count_insert - 1][1] +=
                                        text_insert.substring(0, commonlength);
                                }
                                else {
                                    diffs.splice(0, 0, [0 /* DiffOp.Equal */,
                                        text_insert.substring(0, commonlength)]);
                                    pointer++;
                                }
                                text_insert = text_insert.substring(commonlength);
                                text_delete = text_delete.substring(commonlength);
                            }
                            // Factor out any common suffixies.
                            commonlength = this.diff_commonSuffix(text_insert, text_delete);
                            if (commonlength !== 0) {
                                diffs[pointer][1] = text_insert.substring(text_insert.length -
                                    commonlength) + diffs[pointer][1];
                                text_insert = text_insert.substring(0, text_insert.length -
                                    commonlength);
                                text_delete = text_delete.substring(0, text_delete.length -
                                    commonlength);
                            }
                        }
                        // Delete the offending records and add the merged ones.
                        if (count_delete === 0) {
                            diffs.splice(pointer - count_insert, count_delete + count_insert, [1 /* DiffOp.Insert */, text_insert]);
                        }
                        else if (count_insert === 0) {
                            diffs.splice(pointer - count_delete, count_delete + count_insert, [-1 /* DiffOp.Delete */, text_delete]);
                        }
                        else {
                            diffs.splice(pointer - count_delete - count_insert, count_delete + count_insert, [-1 /* DiffOp.Delete */, text_delete], [1 /* DiffOp.Insert */, text_insert]);
                        }
                        pointer = pointer - count_delete - count_insert +
                            (count_delete ? 1 : 0) + (count_insert ? 1 : 0) + 1;
                    }
                    else if (pointer !== 0 && diffs[pointer - 1][0] == 0 /* DiffOp.Equal */) {
                        // Merge this equality with the previous one.
                        diffs[pointer - 1][1] += diffs[pointer][1];
                        diffs.splice(pointer, 1);
                    }
                    else {
                        pointer++;
                    }
                    count_insert = 0;
                    count_delete = 0;
                    text_delete = '';
                    text_insert = '';
                    break;
            }
        }
        if (diffs[diffs.length - 1][1] === '') {
            diffs.pop(); // Remove the dummy entry at the end.
        }
        // Second pass: look for single edits surrounded on both sides by equalities
        // which can be shifted sideways to eliminate an equality.
        // e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC
        let changes = false;
        pointer = 1;
        // Intentionally ignore the first and last element (don't need checking).
        while (pointer < diffs.length - 1) {
            if (diffs[pointer - 1][0] == 0 /* DiffOp.Equal */ &&
                diffs[pointer + 1][0] == 0 /* DiffOp.Equal */) {
                // This is a single edit surrounded by equalities.
                if (diffs[pointer][1].substring(diffs[pointer][1].length -
                    diffs[pointer - 1][1].length) == diffs[pointer - 1][1]) {
                    // Shift the edit over the previous equality.
                    diffs[pointer][1] = diffs[pointer - 1][1] +
                        diffs[pointer][1].substring(0, diffs[pointer][1].length -
                            diffs[pointer - 1][1].length);
                    diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1];
                    diffs.splice(pointer - 1, 1);
                    changes = true;
                }
                else if (diffs[pointer][1].substring(0, diffs[pointer + 1][1].length) ==
                    diffs[pointer + 1][1]) {
                    // Shift the edit over the next equality.
                    diffs[pointer - 1][1] += diffs[pointer + 1][1];
                    diffs[pointer][1] =
                        diffs[pointer][1].substring(diffs[pointer + 1][1].length) +
                            diffs[pointer + 1][1];
                    diffs.splice(pointer + 1, 1);
                    changes = true;
                }
            }
            pointer++;
        }
        // If shifts were made, the diff needs reordering and another shift sweep.
        if (changes) {
            this.diff_cleanupMerge(diffs);
        }
    }
    ;
    /**
     * loc is a location in text1, compute and return the equivalent location in
     * text2.
     * e.g. 'The cat' vs 'The big cat', 1->1, 5->8
     * @param  diffs Array of diff tuples.
     * @param  loc Location within text1.
     * @return  Location within text2.
     */
    diff_xIndex(diffs, loc) {
        let chars1 = 0;
        let chars2 = 0;
        let last_chars1 = 0;
        let last_chars2 = 0;
        let x;
        for (x = 0; x < diffs.length; x++) {
            if (diffs[x][0] !== 1 /* DiffOp.Insert */) { // Equality or deletion.
                chars1 += diffs[x][1].length;
            }
            if (diffs[x][0] !== -1 /* DiffOp.Delete */) { // Equality or insertion.
                chars2 += diffs[x][1].length;
            }
            if (chars1 > loc) { // Overshot the location.
                break;
            }
            last_chars1 = chars1;
            last_chars2 = chars2;
        }
        // Was the location was deleted?
        if (diffs.length != x && diffs[x][0] === -1 /* DiffOp.Delete */) {
            return last_chars2;
        }
        // Add the remaining character length.
        return last_chars2 + (loc - last_chars1);
    }
    ;
    /**
     * Compute and return the source text (all equalities and deletions).
     * @param  diffs Array of diff tuples.
     * @return  Source text.
     */
    diff_text1(diffs) {
        const text = [];
        for (let x = 0; x < diffs.length; x++) {
            if (diffs[x][0] !== 1 /* DiffOp.Insert */) {
                text[x] = diffs[x][1];
            }
        }
        return text.join('');
    }
    ;
    /**
     * Compute and return the destination text (all equalities and insertions).
     * @param  diffs Array of diff tuples.
     * @return  Destination text.
     */
    diff_text2(diffs) {
        const text = [];
        for (let x = 0; x < diffs.length; x++) {
            if (diffs[x][0] !== -1 /* DiffOp.Delete */) {
                text[x] = diffs[x][1];
            }
        }
        return text.join('');
    }
    ;
    /**
     * Compute the Levenshtein distance; the number of inserted, deleted or
     * substituted characters.
     * @param  diffs Array of diff tuples.
     * @return  Number of changes.
     */
    diff_levenshtein(diffs) {
        let levenshtein = 0;
        let insertions = 0;
        let deletions = 0;
        for (let x = 0; x < diffs.length; x++) {
            const op = diffs[x][0];
            const data = diffs[x][1];
            switch (op) {
                case 1 /* DiffOp.Insert */:
                    insertions += data.length;
                    break;
                case -1 /* DiffOp.Delete */:
                    deletions += data.length;
                    break;
                case 0 /* DiffOp.Equal */:
                    // A deletion and an insertion is one substitution.
                    levenshtein += Math.max(insertions, deletions);
                    insertions = 0;
                    deletions = 0;
                    break;
            }
        }
        levenshtein += Math.max(insertions, deletions);
        return levenshtein;
    }
    ;
    /**
     * Crush the diff into an encoded string which describes the operations
     * required to transform text1 into text2.
     * E.g. =3\t-2\t+ing  -> Keep 3 chars, delete 2 chars, insert 'ing'.
     * Operations are tab-separated.  Inserted text is escaped using %xx notation.
     * @param  diffs Array of diff tuples.
     * @return  Delta text.
     */
    diff_toDelta(diffs) {
        const text = [];
        for (let x = 0; x < diffs.length; x++) {
            switch (diffs[x][0]) {
                case 1 /* DiffOp.Insert */:
                    text[x] = '+' + encodeURI(diffs[x][1]);
                    break;
                case -1 /* DiffOp.Delete */:
                    text[x] = '-' + diffs[x][1].length;
                    break;
                case 0 /* DiffOp.Equal */:
                    text[x] = '=' + diffs[x][1].length;
                    break;
            }
        }
        return text.join('\t').replace(/%20/g, ' ');
    }
    ;
    /**
     * Given the original text1, and an encoded string which describes the
     * operations required to transform text1 into text2, compute the full diff.
     * @param  text1 Source string for the diff.
     * @param  delta Delta text.
     * @return  Array of diff tuples.
     * @throws {!Error} If invalid input.
     */
    diff_fromDelta(text1, delta) {
        const diffs = [];
        let diffsLength = 0; // Keeping our own length const is faster in JS.
        let pointer = 0; // Cursor in text1
        const tokens = delta.split(/\t/g);
        for (let x = 0; x < tokens.length; x++) {
            // Each token begins with a one character parameter which specifies the
            // operation of this token (delete, insert, equality).
            const param = tokens[x].substring(1);
            switch (tokens[x].charAt(0)) {
                case '+':
                    try {
                        diffs[diffsLength++] = [1 /* DiffOp.Insert */, decodeURI(param)];
                    }
                    catch (ex) {
                        // Malformed URI sequence.
                        throw new Error('Illegal escape in diff_fromDelta: ' + param);
                    }
                    break;
                case '-':
                // Fall through.
                case '=':
                    const n = parseInt(param, 10);
                    if (isNaN(n) || n < 0) {
                        throw new Error('Invalid number in diff_fromDelta: ' + param);
                    }
                    const text = text1.substring(pointer, pointer += n);
                    if (tokens[x].charAt(0) == '=') {
                        diffs[diffsLength++] = [0 /* DiffOp.Equal */, text];
                    }
                    else {
                        diffs[diffsLength++] = [-1 /* DiffOp.Delete */, text];
                    }
                    break;
                default:
                    // Blank tokens are ok (from a trailing \t).
                    // Anything else is an error.
                    if (tokens[x]) {
                        throw new Error('Invalid diff operation in diff_fromDelta: ' +
                            tokens[x]);
                    }
            }
        }
        if (pointer != text1.length) {
            throw new Error('Delta length (' + pointer +
                ') does not equal source text length (' + text1.length + ').');
        }
        return diffs;
    }
    ;
    /**
     * Locate the best instance of 'pattern' in 'text' near 'loc'.
     * @param  text The text to search.
     * @param  pattern The pattern to search for.
     * @param  loc The location to search around.
     * @return  Best match index or -1.
     */
    match_main(text, pattern, loc) {
        // Check for null inputs.
        if (text == null || pattern == null || loc == null) {
            throw new Error('Null input. (match_main)');
        }
        loc = Math.max(0, Math.min(loc, text.length));
        if (text == pattern) {
            // Shortcut (potentially not guaranteed by the algorithm)
            return 0;
        }
        else if (!text.length) {
            // Nothing to match.
            return -1;
        }
        else if (text.substring(loc, loc + pattern.length) == pattern) {
            // Perfect match at the perfect spot!  (Includes case of null pattern)
            return loc;
        }
        else {
            // Do a fuzzy compare.
            return this.match_bitap_(text, pattern, loc);
        }
    }
    ;
    /**
     * Locate the best instance of 'pattern' in 'text' near 'loc' using the
     * Bitap algorithm.
     * @param  text The text to search.
     * @param  pattern The pattern to search for.
     * @param  loc The location to search around.
     * @return  Best match index or -1.
  
     */
    match_bitap_(text, pattern, loc) {
        if (pattern.length > this.Match_MaxBits) {
            throw new Error('Pattern too long for this browser.');
        }
        // Initialise the alphabet.
        const s = this.match_alphabet_(pattern);
        const dmp = this; // 'this' becomes 'window' in a closure.
        /**
         * Compute and return the score for a match with e errors and x location.
         * Accesses loc and pattern through being a closure.
         * @param  e Number of errors in match.
         * @param  x Location of match.
         * @return  Overall score for match (0.0 = good, 1.0 = bad).
    
         */
        function match_bitapScore_(e, x) {
            const accuracy = e / pattern.length;
            const proximity = Math.abs(loc - x);
            if (!dmp.Match_Distance) {
                // Dodge divide by zero error.
                return proximity ? 1.0 : accuracy;
            }
            return accuracy + (proximity / dmp.Match_Distance);
        }
        // Highest score beyond which we give up.
        let score_threshold = this.Match_Threshold;
        // Is there a nearby exact match? (speedup)
        let best_loc = text.indexOf(pattern, loc);
        if (best_loc != -1) {
            score_threshold = Math.min(match_bitapScore_(0, best_loc), score_threshold);
            // What about in the other direction? (speedup)
            best_loc = text.lastIndexOf(pattern, loc + pattern.length);
            if (best_loc != -1) {
                score_threshold =
                    Math.min(match_bitapScore_(0, best_loc), score_threshold);
            }
        }
        // Initialise the bit arrays.
        const matchmask = 1 << (pattern.length - 1);
        best_loc = -1;
        let bin_min, bin_mid;
        let bin_max = pattern.length + text.length;
        let last_rd;
        for (let d = 0; d < pattern.length; d++) {
            // Scan for the best match; each iteration allows for one more error.
            // Run a binary search to determine how far from 'loc' we can stray at this
            // error level.
            bin_min = 0;
            bin_mid = bin_max;
            while (bin_min < bin_mid) {
                if (match_bitapScore_(d, loc + bin_mid) <= score_threshold) {
                    bin_min = bin_mid;
                }
                else {
                    bin_max = bin_mid;
                }
                bin_mid = Math.floor((bin_max - bin_min) / 2 + bin_min);
            }
            // Use the result from this iteration as the maximum for the next.
            bin_max = bin_mid;
            let start = Math.max(1, loc - bin_mid + 1);
            const finish = Math.min(loc + bin_mid, text.length) + pattern.length;
            const rd = Array(finish + 2);
            rd[finish + 1] = (1 << d) - 1;
            for (let j = finish; j >= start; j--) {
                // The alphabet (s) is a sparse hash, so the following line generates
                // warnings.
                const charMatch = s[text.charAt(j - 1)];
                if (d === 0) { // First pass: exact match.
                    rd[j] = ((rd[j + 1] << 1) | 1) & charMatch;
                }
                else { // Subsequent passes: fuzzy match.
                    rd[j] = (((rd[j + 1] << 1) | 1) & charMatch) |
                        (((last_rd[j + 1] | last_rd[j]) << 1) | 1) |
                        last_rd[j + 1];
                }
                if (rd[j] & matchmask) {
                    const score = match_bitapScore_(d, j - 1);
                    // This match will almost certainly be better than any existing match.
                    // But check anyway.
                    if (score <= score_threshold) {
                        // Told you so.
                        score_threshold = score;
                        best_loc = j - 1;
                        if (best_loc > loc) {
                            // When passing loc, don't exceed our current distance from loc.
                            start = Math.max(1, 2 * loc - best_loc);
                        }
                        else {
                            // Already passed loc, downhill from here on in.
                            break;
                        }
                    }
                }
            }
            // No hope for a (better) match at greater error levels.
            if (match_bitapScore_(d + 1, loc) > score_threshold) {
                break;
            }
            last_rd = rd;
        }
        return best_loc;
    }
    ;
    /**
     * Initialise the alphabet for the Bitap algorithm.
     * @param  pattern The text to encode.
     * @return  Hash of character locations.
  
     */
    match_alphabet_(pattern) {
        const s = {};
        for (let i = 0; i < pattern.length; i++) {
            s[pattern.charAt(i)] = 0;
        }
        for (let i = 0; i < pattern.length; i++) {
            s[pattern.charAt(i)] |= 1 << (pattern.length - i - 1);
        }
        return s;
    }
    ;
    /**
     * Increase the context until it is unique,
     * but don't let the pattern expand beyond Match_MaxBits.
     * @param  patch The patch to grow.
     * @param  text Source text.
  
     */
    patch_addContext_(patch, text) {
        if (text.length == 0) {
            return;
        }
        let pattern = text.substring(patch.start2, patch.start2 + patch.length1);
        let padding = 0;
        // Look for the first and last matches of pattern in text.  If two different
        // matches are found, increase the pattern length.
        while (text.indexOf(pattern) != text.lastIndexOf(pattern) &&
            pattern.length < this.Match_MaxBits - this.Patch_Margin -
                this.Patch_Margin) {
            padding += this.Patch_Margin;
            pattern = text.substring(patch.start2 - padding, patch.start2 + patch.length1 + padding);
        }
        // Add one chunk for good luck.
        padding += this.Patch_Margin;
        // Add the prefix.
        const prefix = text.substring(patch.start2 - padding, patch.start2);
        if (prefix) {
            patch.diffs.unshift([0 /* DiffOp.Equal */, prefix]);
        }
        // Add the suffix.
        const suffix = text.substring(patch.start2 + patch.length1, patch.start2 + patch.length1 + padding);
        if (suffix) {
            patch.diffs.push([0 /* DiffOp.Equal */, suffix]);
        }
        // Roll back the start points.
        patch.start1 -= prefix.length;
        patch.start2 -= prefix.length;
        // Extend the lengths.
        patch.length1 += prefix.length + suffix.length;
        patch.length2 += prefix.length + suffix.length;
    }
    ;
    /**
     * Compute a list of patches to turn text1 into text2.
     * Use diffs if provided, otherwise compute it ourselves.
     * There are four ways to call this function, depending on what data is
     * available to the caller:
     * Method 1:
     * a = text1, b = text2
     * Method 2:
     * a = diffs
     * Method 3 (optimal):
     * a = text1, b = diffs
     * Method 4 (deprecated, use method 3):
     * a = text1, b = text2, c = diffs
     *
     * @param  a text1 (methods 1,3,4) or
     * Array of diff tuples for text1 to text2 (method 2).
     * @param  opt_b text2 (methods 1,4) or
     * Array of diff tuples for text1 to text2 (method 3) or undefined (method 2).
     * @param  opt_c Array of diff tuples
     * for text1 to text2 (method 4) or undefined (methods 1,2,3).
     * @return  Array of Patch objects.
     */
    patch_make(a, opt_b, opt_c) {
        let text1, diffs;
        if (typeof a == 'string' && typeof opt_b == 'string' &&
            typeof opt_c == 'undefined') {
            // Method 1: text1, text2
            // Compute diffs from text1 and text2.
            text1 = (a);
            diffs = this.diff_main(text1, (opt_b), true);
            if (diffs.length > 2) {
                this.diff_cleanupSemantic(diffs);
                this.diff_cleanupEfficiency(diffs);
            }
        }
        else if (a && typeof a == 'object' && typeof opt_b == 'undefined' &&
            typeof opt_c == 'undefined') {
            // Method 2: diffs
            // Compute text1 from diffs.
            diffs = (a);
            text1 = this.diff_text1(diffs);
        }
        else if (typeof a == 'string' && opt_b && typeof opt_b == 'object' &&
            typeof opt_c == 'undefined') {
            // Method 3: text1, diffs
            text1 = (a);
            diffs = (opt_b);
        }
        else if (typeof a == 'string' && typeof opt_b == 'string' &&
            opt_c && typeof opt_c == 'object') {
            // Method 4: text1, text2, diffs
            // text2 is not used.
            text1 = (a);
            diffs = (opt_c);
        }
        else {
            throw new Error('Unknown call format to patch_make.');
        }
        if (diffs.length === 0) {
            return []; // Get rid of the null case.
        }
        const patches = [];
        let patch = new patch_obj();
        let patchDiffLength = 0; // Keeping our own length const is faster in JS.
        let char_count1 = 0; // Number of characters into the text1 string.
        let char_count2 = 0; // Number of characters into the text2 string.
        // Start with text1 (prepatch_text) and apply the diffs until we arrive at
        // text2 (postpatch_text).  We recreate the patches one by one to determine
        // context info.
        let prepatch_text = text1;
        let postpatch_text = text1;
        for (let x = 0; x < diffs.length; x++) {
            const diff_type = diffs[x][0];
            const diff_text = diffs[x][1];
            if (!patchDiffLength && diff_type !== 0 /* DiffOp.Equal */) {
                // A new patch starts here.
                patch.start1 = char_count1;
                patch.start2 = char_count2;
            }
            switch (diff_type) {
                case 1 /* DiffOp.Insert */:
                    patch.diffs[patchDiffLength++] = diffs[x];
                    patch.length2 += diff_text.length;
                    postpatch_text = postpatch_text.substring(0, char_count2) + diff_text +
                        postpatch_text.substring(char_count2);
                    break;
                case -1 /* DiffOp.Delete */:
                    patch.length1 += diff_text.length;
                    patch.diffs[patchDiffLength++] = diffs[x];
                    postpatch_text = postpatch_text.substring(0, char_count2) +
                        postpatch_text.substring(char_count2 +
                            diff_text.length);
                    break;
                case 0 /* DiffOp.Equal */:
                    if (diff_text.length <= 2 * this.Patch_Margin &&
                        patchDiffLength && diffs.length != x + 1) {
                        // Small equality inside a patch.
                        patch.diffs[patchDiffLength++] = diffs[x];
                        patch.length1 += diff_text.length;
                        patch.length2 += diff_text.length;
                    }
                    else if (diff_text.length >= 2 * this.Patch_Margin) {
                        // Time for a new patch.
                        if (patchDiffLength) {
                            this.patch_addContext_(patch, prepatch_text);
                            patches.push(patch);
                            patch = new patch_obj();
                            patchDiffLength = 0;
                            // Unlike Unidiff, our patch lists have a rolling context.
                            // http://code.google.com/p/google-diff-match-patch/wiki/Unidiff
                            // Update prepatch text & pos to reflect the application of the
                            // just completed patch.
                            prepatch_text = postpatch_text;
                            char_count1 = char_count2;
                        }
                    }
                    break;
            }
            // Update the current character count.
            if (diff_type !== 1 /* DiffOp.Insert */) {
                char_count1 += diff_text.length;
            }
            if (diff_type !== -1 /* DiffOp.Delete */) {
                char_count2 += diff_text.length;
            }
        }
        // Pick up the leftover patch if not empty.
        if (patchDiffLength) {
            this.patch_addContext_(patch, prepatch_text);
            patches.push(patch);
        }
        return patches;
    }
    ;
    /**
     * Given an array of patches, return another array that is identical.
     * @param  patches Array of Patch objects.
     * @return  Array of Patch objects.
     */
    patch_deepCopy(patches) {
        // Making deep copies is hard in JavaScript.
        const patchesCopy = [];
        for (let x = 0; x < patches.length; x++) {
            const patch = patches[x];
            const patchCopy = new patch_obj();
            patchCopy.diffs = [];
            for (let y = 0; y < patch.diffs.length; y++) {
                patchCopy.diffs[y] = [patch.diffs[y][0], patch.diffs[y][1]];
            }
            patchCopy.start1 = patch.start1;
            patchCopy.start2 = patch.start2;
            patchCopy.length1 = patch.length1;
            patchCopy.length2 = patch.length2;
            patchesCopy[x] = patchCopy;
        }
        return patchesCopy;
    }
    ;
    /**
     * Merge a set of patches onto the text.  Return a patched text, as well
     * as a list of true/false values indicating which patches were applied.
     * @param  patches Array of Patch objects.
     * @param  text Old text.
     * @return  Two element Array, containing the
     *      new text and an array of boolean values.
     */
    patch_apply(patches, text) {
        if (patches.length == 0) {
            return [text, []];
        }
        // Deep copy the patches so that no changes are made to originals.
        patches = this.patch_deepCopy(patches);
        const nullPadding = this.patch_addPadding(patches);
        text = nullPadding + text + nullPadding;
        this.patch_splitMax(patches);
        // delta keeps track of the offset between the expected and actual location
        // of the previous patch.  If there are patches expected at positions 10 and
        // 20, but the first patch was found at 12, delta is 2 and the second patch
        // has an effective expected position of 22.
        let delta = 0;
        const results = [];
        for (let x = 0; x < patches.length; x++) {
            const expected_loc = patches[x].start2 + delta;
            const text1 = this.diff_text1(patches[x].diffs);
            let start_loc;
            let end_loc = -1;
            if (text1.length > this.Match_MaxBits) {
                // patch_splitMax will only provide an oversized pattern in the case of
                // a monster delete.
                start_loc = this.match_main(text, text1.substring(0, this.Match_MaxBits), expected_loc);
                if (start_loc != -1) {
                    end_loc = this.match_main(text, text1.substring(text1.length - this.Match_MaxBits), expected_loc + text1.length - this.Match_MaxBits);
                    if (end_loc == -1 || start_loc >= end_loc) {
                        // Can't find valid trailing context.  Drop this patch.
                        start_loc = -1;
                    }
                }
            }
            else {
                start_loc = this.match_main(text, text1, expected_loc);
            }
            if (start_loc == -1) {
                // No match found.  :(
                results[x] = false;
                // Subtract the delta for this failed patch from subsequent patches.
                delta -= patches[x].length2 - patches[x].length1;
            }
            else {
                // Found a match.  :)
                results[x] = true;
                delta = start_loc - expected_loc;
                let text2;
                if (end_loc == -1) {
                    text2 = text.substring(start_loc, start_loc + text1.length);
                }
                else {
                    text2 = text.substring(start_loc, end_loc + this.Match_MaxBits);
                }
                if (text1 == text2) {
                    // Perfect match, just shove the replacement text in.
                    text = text.substring(0, start_loc) +
                        this.diff_text2(patches[x].diffs) +
                        text.substring(start_loc + text1.length);
                }
                else {
                    // Imperfect match.  Run a diff to get a framework of equivalent
                    // indices.
                    const diffs = this.diff_main(text1, text2, false);
                    if (text1.length > this.Match_MaxBits &&
                        this.diff_levenshtein(diffs) / text1.length >
                            this.Patch_DeleteThreshold) {
                        // The end points match, but the content is unacceptably bad.
                        results[x] = false;
                    }
                    else {
                        this.diff_cleanupSemanticLossless(diffs);
                        let index1 = 0;
                        let index2;
                        for (let y = 0; y < patches[x].diffs.length; y++) {
                            const mod = patches[x].diffs[y];
                            if (mod[0] !== 0 /* DiffOp.Equal */) {
                                index2 = this.diff_xIndex(diffs, index1);
                            }
                            if (mod[0] === 1 /* DiffOp.Insert */) { // Insertion
                                text = text.substring(0, start_loc + index2) + mod[1] +
                                    text.substring(start_loc + index2);
                            }
                            else if (mod[0] === -1 /* DiffOp.Delete */) { // Deletion
                                text = text.substring(0, start_loc + index2) +
                                    text.substring(start_loc + this.diff_xIndex(diffs, index1 + mod[1].length));
                            }
                            if (mod[0] !== -1 /* DiffOp.Delete */) {
                                index1 += mod[1].length;
                            }
                        }
                    }
                }
            }
        }
        // Strip the padding off.
        text = text.substring(nullPadding.length, text.length - nullPadding.length);
        return [text, results];
    }
    ;
    /**
     * Add some padding on text start and end so that edges can match something.
     * Intended to be called only from within patch_apply.
     * @param  patches Array of Patch objects.
     * @return  The padding string added to each side.
     */
    patch_addPadding(patches) {
        const paddingLength = this.Patch_Margin;
        let nullPadding = '';
        for (let x = 1; x <= paddingLength; x++) {
            nullPadding += String.fromCharCode(x);
        }
        // Bump all the patches forward.
        for (let x = 0; x < patches.length; x++) {
            patches[x].start1 += paddingLength;
            patches[x].start2 += paddingLength;
        }
        // Add some padding on start of first diff.
        let patch = patches[0];
        let diffs = patch.diffs;
        if (diffs.length == 0 || diffs[0][0] != 0 /* DiffOp.Equal */) {
            // Add nullPadding equality.
            diffs.unshift([0 /* DiffOp.Equal */, nullPadding]);
            patch.start1 -= paddingLength; // Should be 0.
            patch.start2 -= paddingLength; // Should be 0.
            patch.length1 += paddingLength;
            patch.length2 += paddingLength;
        }
        else if (paddingLength > diffs[0][1].length) {
            // Grow first equality.
            const extraLength = paddingLength - diffs[0][1].length;
            diffs[0][1] = nullPadding.substring(diffs[0][1].length) + diffs[0][1];
            patch.start1 -= extraLength;
            patch.start2 -= extraLength;
            patch.length1 += extraLength;
            patch.length2 += extraLength;
        }
        // Add some padding on end of last diff.
        patch = patches[patches.length - 1];
        diffs = patch.diffs;
        if (diffs.length == 0 || diffs[diffs.length - 1][0] != 0 /* DiffOp.Equal */) {
            // Add nullPadding equality.
            diffs.push([0 /* DiffOp.Equal */, nullPadding]);
            patch.length1 += paddingLength;
            patch.length2 += paddingLength;
        }
        else if (paddingLength > diffs[diffs.length - 1][1].length) {
            // Grow last equality.
            const extraLength = paddingLength - diffs[diffs.length - 1][1].length;
            diffs[diffs.length - 1][1] += nullPadding.substring(0, extraLength);
            patch.length1 += extraLength;
            patch.length2 += extraLength;
        }
        return nullPadding;
    }
    ;
    /**
     * Take a list of patches and return a textual representation.
     * @param  patches Array of Patch objects.
     * @return  Text representation of patches.
     */
    patch_toText(patches) {
        const text = [];
        for (let x = 0; x < patches.length; x++) {
            text[x] = patches[x];
        }
        return text.join('');
    }
    ;
    /**
     * Parse a textual representation of patches and return a list of Patch objects.
     * @param  textline Text representation of patches.
     * @return  Array of Patch objects.
     * @throws {!Error} If invalid input.
     */
    patch_fromText(textline) {
        const patches = [];
        if (!textline) {
            return patches;
        }
        const text = textline.split('\n');
        let textPointer = 0;
        const patchHeader = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@$/;
        while (textPointer < text.length) {
            const m = text[textPointer].match(patchHeader);
            if (!m) {
                throw new Error('Invalid patch string: ' + text[textPointer]);
            }
            const patch = new patch_obj();
            patches.push(patch);
            patch.start1 = parseInt(m[1], 10);
            if (m[2] === '') {
                patch.start1--;
                patch.length1 = 1;
            }
            else if (m[2] == '0') {
                patch.length1 = 0;
            }
            else {
                patch.start1--;
                patch.length1 = parseInt(m[2], 10);
            }
            patch.start2 = parseInt(m[3], 10);
            if (m[4] === '') {
                patch.start2--;
                patch.length2 = 1;
            }
            else if (m[4] == '0') {
                patch.length2 = 0;
            }
            else {
                patch.start2--;
                patch.length2 = parseInt(m[4], 10);
            }
            textPointer++;
            while (textPointer < text.length) {
                const sign = text[textPointer].charAt(0);
                let line;
                try {
                    line = decodeURI(text[textPointer].substring(1));
                }
                catch (ex) {
                    // Malformed URI sequence.
                    throw new Error('Illegal escape in patch_fromText: ' + line);
                }
                if (sign == '-') {
                    // Deletion.
                    patch.diffs.push([-1 /* DiffOp.Delete */, line]);
                }
                else if (sign == '+') {
                    // Insertion.
                    patch.diffs.push([1 /* DiffOp.Insert */, line]);
                }
                else if (sign == ' ') {
                    // Minor equality.
                    patch.diffs.push([0 /* DiffOp.Equal */, line]);
                }
                else if (sign == '@') {
                    // Start of next patch.
                    break;
                }
                else if (sign === '') {
                    // Blank line?  Whatever.
                }
                else {
                    // WTF?
                    throw new Error('Invalid patch mode "' + sign + '" in: ' + line);
                }
                textPointer++;
            }
        }
        return patches;
    }
    ;
}
/**
 * Class representing one patch operation.

 */
export class patch_obj {
    constructor() {
        this.diffs = [];
        this.start1 = null;
        this.start2 = null;
        this.length1 = 0;
        this.length2 = 0;
        /**
         * Emmulate GNU diff's format.
         * Header: @@ -382,8 +481,9 @@
         * Indicies are printed as 1-based, not 0-based.
         */
        this.toString = function () {
            let coords1, coords2;
            if (this.length1 === 0) {
                coords1 = this.start1 + ',0';
            }
            else if (this.length1 == 1) {
                coords1 = this.start1 + 1;
            }
            else {
                coords1 = (this.start1 + 1) + ',' + this.length1;
            }
            if (this.length2 === 0) {
                coords2 = this.start2 + ',0';
            }
            else if (this.length2 == 1) {
                coords2 = this.start2 + 1;
            }
            else {
                coords2 = (this.start2 + 1) + ',' + this.length2;
            }
            const text = ['@@ -' + coords1 + ' +' + coords2 + ' @@\n'];
            let op;
            // Escape the body of the patch with %xx notation.
            for (let x = 0; x < this.diffs.length; x++) {
                switch (this.diffs[x][0]) {
                    case 1 /* DiffOp.Insert */:
                        op = '+';
                        break;
                    case -1 /* DiffOp.Delete */:
                        op = '-';
                        break;
                    case 0 /* DiffOp.Equal */:
                        op = ' ';
                        break;
                }
                text[x + 1] = op + encodeURI(this.diffs[x][1]) + '\n';
            }
            return text.join('').replace(/%20/g, ' ');
        };
    }
}
export { DiffMatchPatch };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZk1hdGNoUGF0Y2guanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9uZy1kaWZmLW1hdGNoLXBhdGNoL3NyYy9saWIvZGlmZk1hdGNoUGF0Y2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBUUE7OztHQUdHO0FBQ0gsTUFBTSxjQUFjO0lBRWxCO1FBRUEsWUFBWTtRQUNaLDJEQUEyRDtRQUUzRCxxRUFBcUU7UUFDckUsaUJBQVksR0FBRyxHQUFHLENBQUM7UUFDbkIsK0RBQStEO1FBQy9ELGtCQUFhLEdBQUcsQ0FBQyxDQUFDO1FBQ2xCLDJFQUEyRTtRQUMzRSxvQkFBZSxHQUFHLEdBQUcsQ0FBQztRQUN0QiwyRUFBMkU7UUFDM0Usd0VBQXdFO1FBQ3hFLDZDQUE2QztRQUM3QyxtQkFBYyxHQUFHLElBQUksQ0FBQztRQUN0QiwwRUFBMEU7UUFDMUUsNkVBQTZFO1FBQzdFLHlFQUF5RTtRQUN6RSx3Q0FBd0M7UUFDeEMsMEJBQXFCLEdBQUcsR0FBRyxDQUFDO1FBQzVCLGlDQUFpQztRQUNqQyxpQkFBWSxHQUFHLENBQUMsQ0FBQztRQUVqQixnQ0FBZ0M7UUFDaEMsa0JBQWEsR0FBRyxFQUFFLENBQUM7UUFDbkI7Ozs7V0FJRztRQUVILHNEQUFzRDtRQUN0RCxxQkFBZ0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN0QyxvQkFBZSxHQUFHLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3pDLHVCQUFrQixHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzlDLHlCQUFvQixHQUFHLElBQUksTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBaW5DbkQ7Ozs7V0FJRztRQUNELG9CQUFlLEdBQUcsVUFBUyxLQUFrQjtZQUM3QyxNQUFNLElBQUksR0FBRyxFQUFFLENBQUM7WUFDaEIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDO1lBQ3pCLE1BQU0sVUFBVSxH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Q0FnRG5CO0FBRUQsT0FBTyxFQUFFLGNBQWMsRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IGVudW0gRGlmZk9wIHtcbiAgRGVsZXRlID0gLTEsXG4gIEVxdWFsID0gMCxcbiAgSW5zZXJ0ID0gMVxufVxuXG5leHBvcnQgdHlwZSBEaWZmID0gW0RpZmZPcCwgc3RyaW5nXTtcblxuLyoqXG4gKiBDbGFzcyBjb250YWluaW5nIHRoZSBkaWZmLCBtYXRjaCBhbmQgcGF0Y2ggbWV0aG9kcy5cblxuICovXG5jbGFzcyBEaWZmTWF0Y2hQYXRjaCB7XG5cbiAgY29uc3RydWN0b3IoKSB7ICB9XG5cbiAgLy8gRGVmYXVsdHMuXG4gIC8vIFJlZGVmaW5lIHRoZXNlIGluIHlvdXIgcHJvZ3JhbSB0byBvdmVycmlkZSB0aGUgZGVmYXVsdHMuXG5cbiAgLy8gTnVtYmVyIG9mIHNlY29uZHMgdG8gbWFwIGEgZGlmZiBiZWZvcmUgZ2l2aW5nIHVwICgwIGZvciBpbmZpbml0eSkuXG4gIERpZmZfVGltZW91dCA9IDEuMDtcbiAgLy8gQ29zdCBvZiBhbiBlbXB0eSBlZGl0IG9wZXJhdGlvbiBpbiB0ZXJtcyBvZiBlZGl0IGNoYXJhY3RlcnMuXG4gIERpZmZfRWRpdENvc3QgPSA0O1xuICAvLyBBdCB3aGF0IHBvaW50IGlzIG5vIG1hdGNoIGRlY2xhcmVkICgwLjAgPSBwZXJmZWN0aW9uLCAxLjAgPSB2ZXJ5IGxvb3NlKS5cbiAgTWF0Y2hfVGhyZXNob2xkID0gMC41O1xuICAvLyBIb3cgZmFyIHRvIHNlYXJjaCBmb3IgYSBtYXRjaCAoMCA9IGV4YWN0IGxvY2F0aW9uLCAxMDAwKyA9IGJyb2FkIG1hdGNoKS5cbiAgLy8gQSBtYXRjaCB0aGlzIG1hbnkgY2hhcmFjdGVycyBhd2F5IGZyb20gdGhlIGV4cGVjdGVkIGxvY2F0aW9uIHdpbGwgYWRkXG4gIC8vIDEuMCB0byB0aGUgc2NvcmUgKDAuMCBpcyBhIHBlcmZlY3QgbWF0Y2gpLlxuICBNYXRjaF9EaXN0YW5jZSA9IDEwMDA7XG4gIC8vIFdoZW4gZGVsZXRpbmcgYSBsYXJnZSBibG9jayBvZiB0ZXh0IChvdmVyIH42NCBjaGFyYWN0ZXJzKSwgaG93IGNsb3NlIGRvXG4gIC8vIHRoZSBjb250ZW50cyBoYXZlIHRvIGJlIHRvIG1hdGNoIHRoZSBleHBlY3RlZCBjb250ZW50cy4gKDAuMCA9IHBlcmZlY3Rpb24sXG4gIC8vIDEuMCA9IHZlcnkgbG9vc2UpLiAgTm90ZSB0aGF0IE1hdGNoX1RocmVzaG9sZCBjb250cm9scyBob3cgY2xvc2VseSB0aGVcbiAgLy8gZW5kIHBvaW50cyBvZiBhIGRlbGV0ZSBuZWVkIHRvIG1hdGNoLlxuICBQYXRjaF9EZWxldGVUaHJlc2hvbGQgPSAwLjU7XG4gIC8vIENodW5rIHNpemUgZm9yIGNvbnRleHQgbGVuZ3RoLlxuICBQYXRjaF9NYXJnaW4gPSA0O1xuXG4gIC8vIFRoZSBudW1iZXIgb2YgYml0cyBpbiBhbiBpbnQuXG4gIE1hdGNoX01heEJpdHMgPSAzMjtcbiAgLyoqXG4gICAqIFRoZSBkYXRhIHN0cnVjdHVyZSByZXByZXNlbnRpbmcgYSBkaWZmIGlzIGFuIGFycmF5IG9mIHR1cGxlczpcbiAgICogW1tEaWZmT3AuRGVsZXRlLCAnSGVsbG8nXSwgW0RpZmZPcC5JbnNlcnQsICdHb29kYnllJ10sIFtEaWZmT3AuRXF1YWwsICcgd29ybGQuJ11dXG4gICAqIHdoaWNoIG1lYW5zOiBkZWxldGUgJ0hlbGxvJywgYWRkICdHb29kYnllJyBhbmQga2VlcCAnIHdvcmxkLidcbiAgICovXG5cbiAgLy8gRGVmaW5lIHNvbWUgcmVnZXggcGF0dGVybnMgZm9yIG1hdGNoaW5nIGJvdW5kYXJpZXMuXG4gIHdoaXRlc3BhY2VSZWdleF8gPSBuZXcgUmVnRXhwKCcvXFxzLycpO1xuICBsaW5lYnJlYWtSZWdleF8gPSBuZXcgUmVnRXhwKCcvW1xcclxcbl0vJyk7XG4gIGJsYW5rbGluZUVuZFJlZ2V4XyA9IG5ldyBSZWdFeHAoJy9cXG5cXHI/XFxuJC8nKTtcbiAgYmxhbmtsaW5lU3RhcnRSZWdleF8gPSBuZXcgUmVnRXhwKCcvXlxccj9cXG5cXHI/XFxuLycpO1xuXG4gIC8qKlxuICAgKiBGaW5kIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHR3byB0ZXh0cy4gIFNpbXBsaWZpZXMgdGhlIHByb2JsZW0gYnkgc3RyaXBwaW5nXG4gICAqIGFueSBjb21tb24gcHJlZml4IG9yIHN1ZmZpeCBvZmYgdGhlIHRleHRzIGJlZm9yZSBkaWZmaW5nLlxuICAgKiBAcGFyYW0gIHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICAgKiBAcGFyYW0gIHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICAgKiBAcGFyYW0gIG9wdF9jaGVja2xpbmVzIE9wdGlvbmFsIHNwZWVkdXAgZmxhZy4gSWYgcHJlc2VudCBhbmQgZmFsc2UsXG4gICAqICAgICB0aGVuIGRvbid0IHJ1biBhIGxpbmUtbGV2ZWwgZGlmZiBmaXJzdCB0byBpZGVudGlmeSB0aGUgY2hhbmdlZCBhcmVhcy5cbiAgICogICAgIERlZmF1bHRzIHRvIHRydWUsIHdoaWNoIGRvZXMgYSBmYXN0ZXIsIHNsaWdodGx5IGxlc3Mgb3B0aW1hbCBkaWZmLlxuICAgKiBAcGFyYW0gIG9wdF9kZWFkbGluZSBPcHRpb25hbCB0aW1lIHdoZW4gdGhlIGRpZmYgc2hvdWxkIGJlIGNvbXBsZXRlXG4gICAqICAgICBieS4gIFVzZWQgaW50ZXJuYWxseSBmb3IgcmVjdXJzaXZlIGNhbGxzLiAgVXNlcnMgc2hvdWxkIHNldCBEaWZmVGltZW91dFxuICAgKiAgICAgaW5zdGVhZC5cbiAgICogQHJldHVybiAgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gICAqL1xuICAgIGRpZmZfbWFpbiAodGV4dDE6IHN0cmluZywgdGV4dDI6IHN0cmluZywgb3B0X2NoZWNrbGluZXM/OiBib29sZWFuLCBvcHRfZGVhZGxpbmU/OiBudW1iZXIpOiBBcnJheTxEaWZmPiB7XG4gICAgICAvLyBTZXQgYSBkZWFkbGluZSBieSB3aGljaCB0aW1lIHRoZSBkaWZmIG11c3QgYmUgY29tcGxldGUuXG4gICAgICBpZiAodHlwZW9mIG9wdF9kZWFkbGluZSA9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBpZiAodGhpcy5EaWZmX1RpbWVvdXQgPD0gMCkge1xuICAgICAgICAgIG9wdF9kZWFkbGluZSA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb3B0X2RlYWRsaW5lID0gKG5ldyBEYXRlKS5nZXRUaW1lKCkgKyB0aGlzLkRpZmZfVGltZW91dCAqIDEwMDA7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnN0IGRlYWRsaW5lID0gb3B0X2RlYWRsaW5lO1xuXG4gICAgICAvLyBDaGVjayBmb3IgbnVsbCBpbnB1dHMuXG4gICAgICBpZiAodGV4dDEgPT0gbnVsbCB8fCB0ZXh0MiA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTnVsbCBpbnB1dC4gKGRpZmZfbWFpbiknKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgZm9yIGVxdWFsaXR5IChzcGVlZHVwKS5cbiAgICAgIGlmICh0ZXh0MSA9PSB0ZXh0Mikge1xuICAgICAgICBpZiAodGV4dDEpIHtcbiAgICAgICAgICByZXR1cm4gW1tEaWZmT3AuRXF1YWwsIHRleHQxXV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIG9wdF9jaGVja2xpbmVzID09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIG9wdF9jaGVja2xpbmVzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNoZWNrbGluZXMgPSBvcHRfY2hlY2tsaW5lcztcblxuICAgICAgLy8gVHJpbSBvZmYgY29tbW9uIHByZWZpeCAoc3BlZWR1cCkuXG4gICAgICBsZXQgY29tbW9ubGVuZ3RoID0gdGhpcy5kaWZmX2NvbW1vblByZWZpeCh0ZXh0MSwgdGV4dDIpO1xuICAgICAgY29uc3QgY29tbW9ucHJlZml4ID0gdGV4dDEuc3Vic3RyaW5nKDAsIGNvbW1vbmxlbmd0aCk7XG4gICAgICB0ZXh0MSA9IHRleHQxLnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuICAgICAgdGV4dDIgPSB0ZXh0Mi5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTtcblxuICAgICAgLy8gVHJpbSBvZmYgY29tbW9uIHN1ZmZpeCAoc3BlZWR1cCkuXG4gICAgICBjb21tb25sZW5ndGggPSB0aGlzLmRpZmZfY29tbW9uU3VmZml4KHRleHQxLCB0ZXh0Mik7XG4gICAgICBjb25zdCBjb21tb25zdWZmaXggPSB0ZXh0MS5zdWJzdHJpbmcodGV4dDEubGVuZ3RoIC0gY29tbW9ubGVuZ3RoKTtcbiAgICAgIHRleHQxID0gdGV4dDEuc3Vic3RyaW5nKDAsIHRleHQxLmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7XG4gICAgICB0ZXh0MiA9IHRleHQyLnN1YnN0cmluZygwLCB0ZXh0Mi5sZW5ndGggLSBjb21tb25sZW5ndGgpO1xuXG4gICAgICAvLyBDb21wdXRlIHRoZSBkaWZmIG9uIHRoZSBtaWRkbGUgYmxvY2suXG4gICAgICBjb25zdCBkaWZmcyA9IHRoaXMuZGlmZl9jb21wdXRlXyh0ZXh0MSwgdGV4dDIsIGNoZWNrbGluZXMsIGRlYWRsaW5lKTtcblxuICAgICAgLy8gUmVzdG9yZSB0aGUgcHJlZml4IGFuZCBzdWZmaXguXG4gICAgICBpZiAoY29tbW9ucHJlZml4KSB7XG4gICAgICAgIGRpZmZzLnVuc2hpZnQoW0RpZmZPcC5FcXVhbCwgY29tbW9ucHJlZml4XSk7XG4gICAgICB9XG4gICAgICBpZiAoY29tbW9uc3VmZml4KSB7XG4gICAgICAgIGRpZmZzLnB1c2goW0RpZmZPcC5FcXVhbCwgY29tbW9uc3VmZml4XSk7XG4gICAgICB9XG4gICAgICB0aGlzLmRpZmZfY2xlYW51cE1lcmdlKGRpZmZzKTtcbiAgICAgIHJldHVybiBkaWZmcztcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBGaW5kIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHR3byB0ZXh0cy4gIEFzc3VtZXMgdGhhdCB0aGUgdGV4dHMgZG8gbm90XG4gICAqIGhhdmUgYW55IGNvbW1vbiBwcmVmaXggb3Igc3VmZml4LlxuICAgKiBAcGFyYW0gIHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICAgKiBAcGFyYW0gIHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICAgKiBAcGFyYW0gIGNoZWNrbGluZXMgU3BlZWR1cCBmbGFnLiAgSWYgZmFsc2UsIHRoZW4gZG9uJ3QgcnVuIGFcbiAgICogICAgIGxpbmUtbGV2ZWwgZGlmZiBmaXJzdCB0byBpZGVudGlmeSB0aGUgY2hhbmdlZCBhcmVhcy5cbiAgICogICAgIElmIHRydWUsIHRoZW4gcnVuIGEgZmFzdGVyLCBzbGlnaHRseSBsZXNzIG9wdGltYWwgZGlmZi5cbiAgICogQHBhcmFtICBkZWFkbGluZSBUaW1lIHdoZW4gdGhlIGRpZmYgc2hvdWxkIGJlIGNvbXBsZXRlIGJ5LlxuICAgKiBAcmV0dXJuICBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblxuICAgKi9cbiAgICBkaWZmX2NvbXB1dGVfICh0ZXh0MTogc3RyaW5nLCB0ZXh0Mjogc3RyaW5nLCBjaGVja2xpbmVzOiBib29sZWFuLFxuICAgICAgZGVhZGxpbmU6IG51bWJlcik6IEFycmF5PERpZmY+IHtcbiAgICBsZXQgZGlmZnM6IEFycmF5PERpZmY+O1xuXG4gICAgaWYgKCF0ZXh0MSkge1xuICAgICAgLy8gSnVzdCBhZGQgc29tZSB0ZXh0IChzcGVlZHVwKS5cbiAgICAgIHJldHVybiBbW0RpZmZPcC5JbnNlcnQsIHRleHQyXV07XG4gICAgfVxuXG4gICAgaWYgKCF0ZXh0Mikge1xuICAgICAgLy8gSnVzdCBkZWxldGUgc29tZSB0ZXh0IChzcGVlZHVwKS5cbiAgICAgIHJldHVybiBbW0RpZmZPcC5EZWxldGUsIHRleHQxXV07XG4gICAgfVxuXG4gICAgY29uc3QgbG9uZ3RleHQgPSB0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGggPyB0ZXh0MSA6IHRleHQyO1xuICAgIGNvbnN0IHNob3J0dGV4dCA9IHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCA/IHRleHQyIDogdGV4dDE7XG4gICAgY29uc3QgaSA9IGxvbmd0ZXh0LmluZGV4T2Yoc2hvcnR0ZXh0KTtcbiAgICBpZiAoaSAhPSAtMSkge1xuICAgICAgLy8gU2hvcnRlciB0ZXh0IGlzIGluc2lkZSB0aGUgbG9uZ2VyIHRleHQgKHNwZWVkdXApLlxuICAgICAgZGlmZnMgPSBbW0RpZmZPcC5JbnNlcnQsIGxvbmd0ZXh0LnN1YnN0cmluZygwLCBpKV0sXG4gICAgICAgICAgICAgIFtEaWZmT3AuRXF1YWwsIHNob3J0dGV4dF0sXG4gICAgICAgICAgICAgIFtEaWZmT3AuSW5zZXJ0LCBsb25ndGV4dC5zdWJzdHJpbmcoaSArIHNob3J0dGV4dC5sZW5ndGgpXV07XG4gICAgICAvLyBTd2FwIGluc2VydGlvbnMgZm9yIGRlbGV0aW9ucyBpZiBkaWZmIGlzIHJldmVyc2VkLlxuICAgICAgaWYgKHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCkge1xuICAgICAgICBkaWZmc1swXVswXSA9IGRpZmZzWzJdWzBdID0gRGlmZk9wLkRlbGV0ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBkaWZmcztcbiAgICB9XG5cbiAgICBpZiAoc2hvcnR0ZXh0Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAvLyBTaW5nbGUgY2hhcmFjdGVyIHN0cmluZy5cbiAgICAgIC8vIEFmdGVyIHRoZSBwcmV2aW91cyBzcGVlZHVwLCB0aGUgY2hhcmFjdGVyIGNhbid0IGJlIGFuIGVxdWFsaXR5LlxuICAgICAgcmV0dXJuIFtbRGlmZk9wLkRlbGV0ZSwgdGV4dDFdLCBbRGlmZk9wLkluc2VydCwgdGV4dDJdXTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayB0byBzZWUgaWYgdGhlIHByb2JsZW0gY2FuIGJlIHNwbGl0IGluIHR3by5cbiAgICBjb25zdCBobSA9IHRoaXMuZGlmZl9oYWxmTWF0Y2hfKHRleHQxLCB0ZXh0Mik7XG4gICAgaWYgKGhtKSB7XG4gICAgICAvLyBBIGhhbGYtbWF0Y2ggd2FzIGZvdW5kLCBzb3J0IG91dCB0aGUgcmV0dXJuIGRhdGEuXG4gICAgICBjb25zdCB0ZXh0MV9hID0gaG1bMF07XG4gICAgICBjb25zdCB0ZXh0MV9iID0gaG1bMV07XG4gICAgICBjb25zdCB0ZXh0Ml9hID0gaG1bMl07XG4gICAgICBjb25zdCB0ZXh0Ml9iID0gaG1bM107XG4gICAgICBjb25zdCBtaWRfY29tbW9uID0gaG1bNF07XG4gICAgICAvLyBTZW5kIGJvdGggcGFpcnMgb2ZmIGZvciBzZXBhcmF0ZSBwcm9jZXNzaW5nLlxuICAgICAgY29uc3QgZGlmZnNfYSA9IHRoaXMuZGlmZl9tYWluKHRleHQxX2EsIHRleHQyX2EsIGNoZWNrbGluZXMsIGRlYWRsaW5lKTtcbiAgICAgIGNvbnN0IGRpZmZzX2IgPSB0aGlzLmRpZmZfbWFpbih0ZXh0MV9iLCB0ZXh0Ml9iLCBjaGVja2xpbmVzLCBkZWFkbGluZSk7XG4gICAgICAvLyBNZXJnZSB0aGUgcmVzdWx0cy5cbiAgICAgIHJldHVybiBkaWZmc19hLmNvbmNhdChbW0RpZmZPcC5FcXVhbCwgbWlkX2NvbW1vbl1dLCBkaWZmc19iKTtcbiAgICB9XG5cbiAgICBpZiAoY2hlY2tsaW5lcyAmJiB0ZXh0MS5sZW5ndGggPiAxMDAgJiYgdGV4dDIubGVuZ3RoID4gMTAwKSB7XG4gICAgICByZXR1cm4gdGhpcy5kaWZmX2xpbmVNb2RlXyh0ZXh0MSwgdGV4dDIsIGRlYWRsaW5lKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5kaWZmX2Jpc2VjdF8odGV4dDEsIHRleHQyLCBkZWFkbGluZSk7XG4gIH07XG5cblxuICAvKipcbiAgICogRG8gYSBxdWljayBsaW5lLWxldmVsIGRpZmYgb24gYm90aCBzdHJpbmdzLCB0aGVuIHJlZGlmZiB0aGUgcGFydHMgZm9yXG4gICAqIGdyZWF0ZXIgYWNjdXJhY3kuXG4gICAqIFRoaXMgc3BlZWR1cCBjYW4gcHJvZHVjZSBub24tbWluaW1hbCBkaWZmcy5cbiAgICogQHBhcmFtICB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAgICogQHBhcmFtICB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAgICogQHBhcmFtICBkZWFkbGluZSBUaW1lIHdoZW4gdGhlIGRpZmYgc2hvdWxkIGJlIGNvbXBsZXRlIGJ5LlxuICAgKiBAcmV0dXJuICBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblxuICAgKi9cbiAgICBkaWZmX2xpbmVNb2RlXyAodGV4dDE6IHN0cmluZywgdGV4dDI6IHN0cmluZywgZGVhZGxpbmU6IG51bWJlcikge1xuICAgIC8vIFNjYW4gdGhlIHRleHQgb24gYSBsaW5lLWJ5LWxpbmUgYmFzaXMgZmlyc3QuXG4gICAgY29uc3QgYSA9IHRoaXMuZGlmZl9saW5lc1RvQ2hhcnNfKHRleHQxLCB0ZXh0Mik7XG4gICAgdGV4dDEgPSBhLmNoYXJzMTtcbiAgICB0ZXh0MiA9IGEuY2hhcnMyO1xuICAgIGNvbnN0IGxpbmVhcnJheSA9IGEubGluZUFycmF5O1xuXG4gICAgY29uc3QgZGlmZnMgPSB0aGlzLmRpZmZfbWFpbih0ZXh0MSwgdGV4dDIsIGZhbHNlLCBkZWFkbGluZSk7XG5cbiAgICAvLyBDb252ZXJ0IHRoZSBkaWZmIGJhY2sgdG8gb3JpZ2luYWwgdGV4dC5cbiAgICB0aGlzLmRpZmZfY2hhcnNUb0xpbmVzXyhkaWZmcywgbGluZWFycmF5KTtcbiAgICAvLyBFbGltaW5hdGUgZnJlYWsgbWF0Y2hlcyAoZS5nLiBibGFuayBsaW5lcylcbiAgICB0aGlzLmRpZmZfY2xlYW51cFNlbWFudGljKGRpZmZzKTtcblxuICAgIC8vIFJlZGlmZiBhbnkgcmVwbGFjZW1lbnQgYmxvY2tzLCB0aGlzIHRpbWUgY2hhcmFjdGVyLWJ5LWNoYXJhY3Rlci5cbiAgICAvLyBBZGQgYSBkdW1teSBlbnRyeSBhdCB0aGUgZW5kLlxuICAgIGRpZmZzLnB1c2goW0RpZmZPcC5FcXVhbCwgJyddKTtcbiAgICBsZXQgcG9pbnRlciA9IDA7XG4gICAgbGV0IGNvdW50X2RlbGV0ZSA9IDA7XG4gICAgbGV0IGNvdW50X2luc2VydCA9IDA7XG4gICAgbGV0IHRleHRfZGVsZXRlID0gJyc7XG4gICAgbGV0IHRleHRfaW5zZXJ0ID0gJyc7XG4gICAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGgpIHtcbiAgICAgIHN3aXRjaCAoZGlmZnNbcG9pbnRlcl1bMF0pIHtcbiAgICAgICAgY2FzZSBEaWZmT3AuSW5zZXJ0OlxuICAgICAgICAgIGNvdW50X2luc2VydCsrO1xuICAgICAgICAgIHRleHRfaW5zZXJ0ICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIERpZmZPcC5EZWxldGU6XG4gICAgICAgICAgY291bnRfZGVsZXRlKys7XG4gICAgICAgICAgdGV4dF9kZWxldGUgKz0gZGlmZnNbcG9pbnRlcl1bMV07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRGlmZk9wLkVxdWFsOlxuICAgICAgICAgIC8vIFVwb24gcmVhY2hpbmcgYW4gZXF1YWxpdHksIGNoZWNrIGZvciBwcmlvciByZWR1bmRhbmNpZXMuXG4gICAgICAgICAgaWYgKGNvdW50X2RlbGV0ZSA+PSAxICYmIGNvdW50X2luc2VydCA+PSAxKSB7XG4gICAgICAgICAgICAvLyBEZWxldGUgdGhlIG9mZmVuZGluZyByZWNvcmRzIGFuZCBhZGQgdGhlIG1lcmdlZCBvbmVzLlxuICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSBjb3VudF9kZWxldGUgLSBjb3VudF9pbnNlcnQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudF9kZWxldGUgKyBjb3VudF9pbnNlcnQpO1xuICAgICAgICAgICAgcG9pbnRlciA9IHBvaW50ZXIgLSBjb3VudF9kZWxldGUgLSBjb3VudF9pbnNlcnQ7XG4gICAgICAgICAgICBjb25zdCBiID0gdGhpcy5kaWZmX21haW4odGV4dF9kZWxldGUsIHRleHRfaW5zZXJ0LCBmYWxzZSwgZGVhZGxpbmUpO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IGIubGVuZ3RoIC0gMTsgaiA+PSAwOyBqLS0pIHtcbiAgICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIsIDAsIGJbal0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcG9pbnRlciA9IHBvaW50ZXIgKyBiLmxlbmd0aDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY291bnRfaW5zZXJ0ID0gMDtcbiAgICAgICAgICBjb3VudF9kZWxldGUgPSAwO1xuICAgICAgICAgIHRleHRfZGVsZXRlID0gJyc7XG4gICAgICAgICAgdGV4dF9pbnNlcnQgPSAnJztcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHBvaW50ZXIrKztcbiAgICB9XG4gICAgZGlmZnMucG9wKCk7ICAvLyBSZW1vdmUgdGhlIGR1bW15IGVudHJ5IGF0IHRoZSBlbmQuXG5cbiAgICByZXR1cm4gZGlmZnM7XG4gIH07XG5cblxuICAvKipcbiAgICogRmluZCB0aGUgJ21pZGRsZSBzbmFrZScgb2YgYSBkaWZmLCBzcGxpdCB0aGUgcHJvYmxlbSBpbiB0d29cbiAgICogYW5kIHJldHVybiB0aGUgcmVjdXJzaXZlbHkgY29uc3RydWN0ZWQgZGlmZi5cbiAgICogU2VlIE15ZXJzIDE5ODYgcGFwZXI6IEFuIE8oTkQpIERpZmZlcmVuY2UgQWxnb3JpdGhtIGFuZCBJdHMgY29uc3RpYXRpb25zLlxuICAgKiBAcGFyYW0gIHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICAgKiBAcGFyYW0gIHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICAgKiBAcGFyYW0gIGRlYWRsaW5lIFRpbWUgYXQgd2hpY2ggdG8gYmFpbCBpZiBub3QgeWV0IGNvbXBsZXRlLlxuICAgKiBAcmV0dXJuICBBcnJheSBvZiBkaWZmIHR1cGxlcy5cblxuICAgKi9cbiAgICBkaWZmX2Jpc2VjdF8gKHRleHQxOiBzdHJpbmcsIHRleHQyOiBzdHJpbmcsIGRlYWRsaW5lOiBudW1iZXIpOiBBcnJheTxEaWZmPiB7XG4gICAgLy8gQ2FjaGUgdGhlIHRleHQgbGVuZ3RocyB0byBwcmV2ZW50IG11bHRpcGxlIGNhbGxzLlxuICAgIGNvbnN0IHRleHQxX2xlbmd0aCA9IHRleHQxLmxlbmd0aDtcbiAgICBjb25zdCB0ZXh0Ml9sZW5ndGggPSB0ZXh0Mi5sZW5ndGg7XG4gICAgY29uc3QgbWF4X2QgPSBNYXRoLmNlaWwoKHRleHQxX2xlbmd0aCArIHRleHQyX2xlbmd0aCkgLyAyKTtcbiAgICBjb25zdCB2X29mZnNldCA9IG1heF9kO1xuICAgIGNvbnN0IHZfbGVuZ3RoID0gMiAqIG1heF9kO1xuICAgIGNvbnN0IHYxID0gbmV3IEFycmF5KHZfbGVuZ3RoKTtcbiAgICBjb25zdCB2MiA9IG5ldyBBcnJheSh2X2xlbmd0aCk7XG4gICAgLy8gU2V0dGluZyBhbGwgZWxlbWVudHMgdG8gLTEgaXMgZmFzdGVyIGluIENocm9tZSAmIEZpcmVmb3ggdGhhbiBtaXhpbmdcbiAgICAvLyBpbnRlZ2VycyBhbmQgdW5kZWZpbmVkLlxuICAgIGZvciAobGV0IHggPSAwOyB4IDwgdl9sZW5ndGg7IHgrKykge1xuICAgICAgdjFbeF0gPSAtMTtcbiAgICAgIHYyW3hdID0gLTE7XG4gICAgfVxuICAgIHYxW3Zfb2Zmc2V0ICsgMV0gPSAwO1xuICAgIHYyW3Zfb2Zmc2V0ICsgMV0gPSAwO1xuICAgIGNvbnN0IGRlbHRhID0gdGV4dDFfbGVuZ3RoIC0gdGV4dDJfbGVuZ3RoO1xuICAgIC8vIElmIHRoZSB0b3RhbCBudW1iZXIgb2YgY2hhcmFjdGVycyBpcyBvZGQsIHRoZW4gdGhlIGZyb250IHBhdGggd2lsbCBjb2xsaWRlXG4gICAgLy8gd2l0aCB0aGUgcmV2ZXJzZSBwYXRoLlxuICAgIGNvbnN0IGZyb250ID0gKGRlbHRhICUgMiAhPSAwKTtcbiAgICAvLyBPZmZzZXRzIGZvciBzdGFydCBhbmQgZW5kIG9mIGsgbG9vcC5cbiAgICAvLyBQcmV2ZW50cyBtYXBwaW5nIG9mIHNwYWNlIGJleW9uZCB0aGUgZ3JpZC5cbiAgICBsZXQgazFzdGFydCA9IDA7XG4gICAgbGV0IGsxZW5kID0gMDtcbiAgICBsZXQgazJzdGFydCA9IDA7XG4gICAgbGV0IGsyZW5kID0gMDtcbiAgICBmb3IgKGxldCBkID0gMDsgZCA8IG1heF9kOyBkKyspIHtcbiAgICAgIC8vIEJhaWwgb3V0IGlmIGRlYWRsaW5lIGlzIHJlYWNoZWQuXG4gICAgICBpZiAoKG5ldyBEYXRlKCkpLmdldFRpbWUoKSA+IGRlYWRsaW5lKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBXYWxrIHRoZSBmcm9udCBwYXRoIG9uZSBzdGVwLlxuICAgICAgZm9yIChsZXQgazEgPSAtZCArIGsxc3RhcnQ7IGsxIDw9IGQgLSBrMWVuZDsgazEgKz0gMikge1xuICAgICAgICBjb25zdCBrMV9vZmZzZXQgPSB2X29mZnNldCArIGsxO1xuICAgICAgICBsZXQgeDE7XG4gICAgICAgIGlmIChrMSA9PSAtZCB8fCAoazEgIT0gZCAmJiB2MVtrMV9vZmZzZXQgLSAxXSA8IHYxW2sxX29mZnNldCArIDFdKSkge1xuICAgICAgICAgIHgxID0gdjFbazFfb2Zmc2V0ICsgMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeDEgPSB2MVtrMV9vZmZzZXQgLSAxXSArIDE7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHkxID0geDEgLSBrMTtcbiAgICAgICAgd2hpbGUgKHgxIDwgdGV4dDFfbGVuZ3RoICYmIHkxIDwgdGV4dDJfbGVuZ3RoICYmXG4gICAgICAgICAgICAgIHRleHQxLmNoYXJBdCh4MSkgPT0gdGV4dDIuY2hhckF0KHkxKSkge1xuICAgICAgICAgIHgxKys7XG4gICAgICAgICAgeTErKztcbiAgICAgICAgfVxuICAgICAgICB2MVtrMV9vZmZzZXRdID0geDE7XG4gICAgICAgIGlmICh4MSA+IHRleHQxX2xlbmd0aCkge1xuICAgICAgICAgIC8vIFJhbiBvZmYgdGhlIHJpZ2h0IG9mIHRoZSBncmFwaC5cbiAgICAgICAgICBrMWVuZCArPSAyO1xuICAgICAgICB9IGVsc2UgaWYgKHkxID4gdGV4dDJfbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gUmFuIG9mZiB0aGUgYm90dG9tIG9mIHRoZSBncmFwaC5cbiAgICAgICAgICBrMXN0YXJ0ICs9IDI7XG4gICAgICAgIH0gZWxzZSBpZiAoZnJvbnQpIHtcbiAgICAgICAgICBjb25zdCBrMl9vZmZzZXQgPSB2X29mZnNldCArIGRlbHRhIC0gazE7XG4gICAgICAgICAgaWYgKGsyX29mZnNldCA+PSAwICYmIGsyX29mZnNldCA8IHZfbGVuZ3RoICYmIHYyW2syX29mZnNldF0gIT0gLTEpIHtcbiAgICAgICAgICAgIC8vIE1pcnJvciB4MiBvbnRvIHRvcC1sZWZ0IGNvb3JkaW5hdGUgc3lzdGVtLlxuICAgICAgICAgICAgY29uc3QgeDIgPSB0ZXh0MV9sZW5ndGggLSB2MltrMl9vZmZzZXRdO1xuICAgICAgICAgICAgaWYgKHgxID49IHgyKSB7XG4gICAgICAgICAgICAgIC8vIE92ZXJsYXAgZGV0ZWN0ZWQuXG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmRpZmZfYmlzZWN0U3BsaXRfKHRleHQxLCB0ZXh0MiwgeDEsIHkxLCBkZWFkbGluZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFdhbGsgdGhlIHJldmVyc2UgcGF0aCBvbmUgc3RlcC5cbiAgICAgIGZvciAobGV0IGsyID0gLWQgKyBrMnN0YXJ0OyBrMiA8PSBkIC0gazJlbmQ7IGsyICs9IDIpIHtcbiAgICAgICAgY29uc3QgazJfb2Zmc2V0ID0gdl9vZmZzZXQgKyBrMjtcbiAgICAgICAgbGV0IHgyOiBudW1iZXI7XG4gICAgICAgIGlmIChrMiA9PSAtZCB8fCAoazIgIT0gZCAmJiB2MltrMl9vZmZzZXQgLSAxXSA8IHYyW2syX29mZnNldCArIDFdKSkge1xuICAgICAgICAgIHgyID0gdjJbazJfb2Zmc2V0ICsgMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeDIgPSB2MltrMl9vZmZzZXQgLSAxXSArIDE7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHkyID0geDIgLSBrMjtcbiAgICAgICAgd2hpbGUgKHgyIDwgdGV4dDFfbGVuZ3RoICYmIHkyIDwgdGV4dDJfbGVuZ3RoICYmXG4gICAgICAgICAgICAgIHRleHQxLmNoYXJBdCh0ZXh0MV9sZW5ndGggLSB4MiAtIDEpID09XG4gICAgICAgICAgICAgIHRleHQyLmNoYXJBdCh0ZXh0Ml9sZW5ndGggLSB5MiAtIDEpKSB7XG4gICAgICAgICAgeDIrKztcbiAgICAgICAgICB5MisrO1xuICAgICAgICB9XG4gICAgICAgIHYyW2syX29mZnNldF0gPSB4MjtcbiAgICAgICAgaWYgKHgyID4gdGV4dDFfbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gUmFuIG9mZiB0aGUgbGVmdCBvZiB0aGUgZ3JhcGguXG4gICAgICAgICAgazJlbmQgKz0gMjtcbiAgICAgICAgfSBlbHNlIGlmICh5MiA+IHRleHQyX2xlbmd0aCkge1xuICAgICAgICAgIC8vIFJhbiBvZmYgdGhlIHRvcCBvZiB0aGUgZ3JhcGguXG4gICAgICAgICAgazJzdGFydCArPSAyO1xuICAgICAgICB9IGVsc2UgaWYgKCFmcm9udCkge1xuICAgICAgICAgIGNvbnN0IGsxX29mZnNldCA9IHZfb2Zmc2V0ICsgZGVsdGEgLSBrMjtcbiAgICAgICAgICBpZiAoazFfb2Zmc2V0ID49IDAgJiYgazFfb2Zmc2V0IDwgdl9sZW5ndGggJiYgdjFbazFfb2Zmc2V0XSAhPSAtMSkge1xuICAgICAgICAgICAgY29uc3QgeDEgPSB2MVtrMV9vZmZzZXRdO1xuICAgICAgICAgICAgY29uc3QgeTEgPSB2X29mZnNldCArIHgxIC0gazFfb2Zmc2V0O1xuICAgICAgICAgICAgLy8gTWlycm9yIHgyIG9udG8gdG9wLWxlZnQgY29vcmRpbmF0ZSBzeXN0ZW0uXG4gICAgICAgICAgICB4MiA9IHRleHQxX2xlbmd0aCAtIHgyO1xuICAgICAgICAgICAgaWYgKHgxID49IHgyKSB7XG4gICAgICAgICAgICAgIC8vIE92ZXJsYXAgZGV0ZWN0ZWQuXG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmRpZmZfYmlzZWN0U3BsaXRfKHRleHQxLCB0ZXh0MiwgeDEsIHkxLCBkZWFkbGluZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERpZmYgdG9vayB0b28gbG9uZyBhbmQgaGl0IHRoZSBkZWFkbGluZSBvclxuICAgIC8vIG51bWJlciBvZiBkaWZmcyBlcXVhbHMgbnVtYmVyIG9mIGNoYXJhY3RlcnMsIG5vIGNvbW1vbmFsaXR5IGF0IGFsbC5cbiAgICByZXR1cm4gW1tEaWZmT3AuRGVsZXRlLCB0ZXh0MV0sIFtEaWZmT3AuSW5zZXJ0LCB0ZXh0Ml1dO1xuICB9O1xuXG5cbiAgLyoqXG4gICAqIEdpdmVuIHRoZSBsb2NhdGlvbiBvZiB0aGUgJ21pZGRsZSBzbmFrZScsIHNwbGl0IHRoZSBkaWZmIGluIHR3byBwYXJ0c1xuICAgKiBhbmQgcmVjdXJzZS5cbiAgICogQHBhcmFtICB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAgICogQHBhcmFtICB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAgICogQHBhcmFtICB4IEluZGV4IG9mIHNwbGl0IHBvaW50IGluIHRleHQxLlxuICAgKiBAcGFyYW0gIHkgSW5kZXggb2Ygc3BsaXQgcG9pbnQgaW4gdGV4dDIuXG4gICAqIEBwYXJhbSAgZGVhZGxpbmUgVGltZSBhdCB3aGljaCB0byBiYWlsIGlmIG5vdCB5ZXQgY29tcGxldGUuXG4gICAqIEByZXR1cm4gIEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuXG4gICAqL1xuICAgIGRpZmZfYmlzZWN0U3BsaXRfICh0ZXh0MTogc3RyaW5nLCB0ZXh0Mjogc3RyaW5nLCB4OiBudW1iZXIsIHk6IG51bWJlciwgZGVhZGxpbmU6IG51bWJlcikge1xuICAgICAgY29uc3QgdGV4dDFhID0gdGV4dDEuc3Vic3RyaW5nKDAsIHgpO1xuICAgICAgY29uc3QgdGV4dDJhID0gdGV4dDIuc3Vic3RyaW5nKDAsIHkpO1xuICAgICAgY29uc3QgdGV4dDFiID0gdGV4dDEuc3Vic3RyaW5nKHgpO1xuICAgICAgY29uc3QgdGV4dDJiID0gdGV4dDIuc3Vic3RyaW5nKHkpO1xuXG4gICAgICAvLyBDb21wdXRlIGJvdGggZGlmZnMgc2VyaWFsbHkuXG4gICAgICBjb25zdCBkaWZmcyA9IHRoaXMuZGlmZl9tYWluKHRleHQxYSwgdGV4dDJhLCBmYWxzZSwgZGVhZGxpbmUpO1xuICAgICAgY29uc3QgZGlmZnNiID0gdGhpcy5kaWZmX21haW4odGV4dDFiLCB0ZXh0MmIsIGZhbHNlLCBkZWFkbGluZSk7XG5cbiAgICAgIHJldHVybiBkaWZmcy5jb25jYXQoZGlmZnNiKTtcbiAgICB9O1xuXG5cbiAgLyoqXG4gICAqIFNwbGl0IHR3byB0ZXh0cyBpbnRvIGFuIGFycmF5IG9mIHN0cmluZ3MuICBSZWR1Y2UgdGhlIHRleHRzIHRvIGEgc3RyaW5nIG9mXG4gICAqIGhhc2hlcyB3aGVyZSBlYWNoIFVuaWNvZGUgY2hhcmFjdGVyIHJlcHJlc2VudHMgb25lIGxpbmUuXG4gICAqIEBwYXJhbSAgdGV4dDEgRmlyc3Qgc3RyaW5nLlxuICAgKiBAcGFyYW0gIHRleHQyIFNlY29uZCBzdHJpbmcuXG4gICAqIEByZXR1cm4gfVxuICAgKiAgICAgQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGVuY29kZWQgdGV4dDEsIHRoZSBlbmNvZGVkIHRleHQyIGFuZFxuICAgKiAgICAgdGhlIGFycmF5IG9mIHVuaXF1ZSBzdHJpbmdzLlxuICAgKiAgICAgVGhlIHplcm90aCBlbGVtZW50IG9mIHRoZSBhcnJheSBvZiB1bmlxdWUgc3RyaW5ncyBpcyBpbnRlbnRpb25hbGx5IGJsYW5rLlxuXG4gICAqL1xuICAgIGRpZmZfbGluZXNUb0NoYXJzXyAodGV4dDE6IHN0cmluZywgdGV4dDI6IHN0cmluZykge1xuICAgICAgY29uc3QgbGluZUFycmF5ID0gW107ICAvLyBlLmcuIGxpbmVBcnJheVs0XSA9PSAnSGVsbG9cXG4nXG4gICAgICBjb25zdCBsaW5lSGFzaCA9IHt9OyAgIC8vIGUuZy4gbGluZUhhc2hbJ0hlbGxvXFxuJ10gPT0gNFxuXG4gICAgICAvLyAnXFx4MDAnIGlzIGEgdmFsaWQgY2hhcmFjdGVyLCBidXQgY29uc3Rpb3VzIGRlYnVnZ2VycyBkb24ndCBsaWtlIGl0LlxuICAgICAgLy8gU28gd2UnbGwgaW5zZXJ0IGEganVuayBlbnRyeSB0byBhdm9pZCBnZW5lcmF0aW5nIGEgbnVsbCBjaGFyYWN0ZXIuXG4gICAgICBsaW5lQXJyYXlbMF0gPSAnJztcblxuXG4gICAgICBjb25zdCBjaGFyczEgPSB0aGlzLmRpZmZfbGluZXNUb0NoYXJzTXVuZ2VfKHRleHQxLCBsaW5lQXJyYXksIGxpbmVIYXNoKTtcbiAgICAgIGNvbnN0IGNoYXJzMiA9IHRoaXMuZGlmZl9saW5lc1RvQ2hhcnNNdW5nZV8odGV4dDIsIGxpbmVBcnJheSwgbGluZUhhc2gpO1xuICAgICAgcmV0dXJuIHtjaGFyczE6IGNoYXJzMSwgY2hhcnMyOiBjaGFyczIsIGxpbmVBcnJheTogbGluZUFycmF5fTtcbiAgIH07XG5cbiAgLyoqXG4gICAqIFNwbGl0IGEgdGV4dCBpbnRvIGFuIGFycmF5IG9mIHN0cmluZ3MuICBSZWR1Y2UgdGhlIHRleHRzIHRvIGEgc3RyaW5nIG9mXG4gICAqIGhhc2hlcyB3aGVyZSBlYWNoIFVuaWNvZGUgY2hhcmFjdGVyIHJlcHJlc2VudHMgb25lIGxpbmUuXG4gICAqIE1vZGlmaWVzIGxpbmVhcnJheSBhbmQgbGluZWhhc2ggdGhyb3VnaCBiZWluZyBhIGNsb3N1cmUuXG4gICAqIEBwYXJhbSAgdGV4dCBTdHJpbmcgdG8gZW5jb2RlLlxuICAgKiBAcmV0dXJuICBFbmNvZGVkIHN0cmluZy5cblxuICAgKi9cbiAgZGlmZl9saW5lc1RvQ2hhcnNNdW5nZV8odGV4dDogc3RyaW5nLCBsaW5lQXJyYXk6IEFycmF5PHN0cmluZz4sIGxpbmVIYXNoOiBhbnkpOiBzdHJpbmcge1xuICAgIGxldCBjaGFycyA9ICcnO1xuICAgIC8vIFdhbGsgdGhlIHRleHQsIHB1bGxpbmcgb3V0IGEgc3Vic3RyaW5nIGZvciBlYWNoIGxpbmUuXG4gICAgLy8gdGV4dC5zcGxpdCgnXFxuJykgd291bGQgd291bGQgdGVtcG9yYXJpbHkgZG91YmxlIG91ciBtZW1vcnkgZm9vdHByaW50LlxuICAgIC8vIE1vZGlmeWluZyB0ZXh0IHdvdWxkIGNyZWF0ZSBtYW55IGxhcmdlIHN0cmluZ3MgdG8gZ2FyYmFnZSBjb2xsZWN0LlxuICAgIGxldCBsaW5lU3RhcnQgPSAwO1xuICAgIGxldCBsaW5lRW5kID0gLTE7XG4gICAgLy8gS2VlcGluZyBvdXIgb3duIGxlbmd0aCBjb25zdGlhYmxlIGlzIGZhc3RlciB0aGFuIGxvb2tpbmcgaXQgdXAuXG4gICAgbGV0IGxpbmVBcnJheUxlbmd0aCA9IGxpbmVBcnJheS5sZW5ndGg7XG4gICAgd2hpbGUgKGxpbmVFbmQgPCB0ZXh0Lmxlbmd0aCAtIDEpIHtcbiAgICAgIGxpbmVFbmQgPSB0ZXh0LmluZGV4T2YoJ1xcbicsIGxpbmVTdGFydCk7XG4gICAgICBpZiAobGluZUVuZCA9PSAtMSkge1xuICAgICAgICBsaW5lRW5kID0gdGV4dC5sZW5ndGggLSAxO1xuICAgICAgfVxuICAgICAgY29uc3QgbGluZSA9IHRleHQuc3Vic3RyaW5nKGxpbmVTdGFydCwgbGluZUVuZCArIDEpO1xuICAgICAgbGluZVN0YXJ0ID0gbGluZUVuZCArIDE7XG5cbiAgICAgIGlmIChsaW5lSGFzaC5oYXNPd25Qcm9wZXJ0eSA/IGxpbmVIYXNoLmhhc093blByb3BlcnR5KGxpbmUpIDpcbiAgICAgICAgICAobGluZUhhc2hbbGluZV0gIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgY2hhcnMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShsaW5lSGFzaFtsaW5lXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaGFycyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGxpbmVBcnJheUxlbmd0aCk7XG4gICAgICAgIGxpbmVIYXNoW2xpbmVdID0gbGluZUFycmF5TGVuZ3RoO1xuICAgICAgICBsaW5lQXJyYXlbbGluZUFycmF5TGVuZ3RoKytdID0gbGluZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNoYXJzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlaHlkcmF0ZSB0aGUgdGV4dCBpbiBhIGRpZmYgZnJvbSBhIHN0cmluZyBvZiBsaW5lIGhhc2hlcyB0byByZWFsIGxpbmVzIG9mXG4gICAqIHRleHQuXG4gICAqIEBwYXJhbSAgZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gICAqIEBwYXJhbSAgbGluZUFycmF5IEFycmF5IG9mIHVuaXF1ZSBzdHJpbmdzLlxuXG4gICAqL1xuICAgIGRpZmZfY2hhcnNUb0xpbmVzXyAoZGlmZnM6IEFycmF5PERpZmY+LCBsaW5lQXJyYXk6IEFycmF5PHN0cmluZz4pOiB2b2lkIHtcbiAgICBmb3IgKGxldCB4ID0gMDsgeCA8IGRpZmZzLmxlbmd0aDsgeCsrKSB7XG4gICAgICBjb25zdCBjaGFycyA9IGRpZmZzW3hdWzFdO1xuICAgICAgY29uc3QgdGV4dCA9IFtdO1xuICAgICAgZm9yIChsZXQgeSA9IDA7IHkgPCBjaGFycy5sZW5ndGg7IHkrKykge1xuICAgICAgICB0ZXh0W3ldID0gbGluZUFycmF5W2NoYXJzLmNoYXJDb2RlQXQoeSldO1xuICAgICAgfVxuICAgICAgZGlmZnNbeF1bMV0gPSB0ZXh0LmpvaW4oJycpO1xuICAgIH1cbiAgfTtcblxuXG4gIC8qKlxuICAgKiBEZXRlcm1pbmUgdGhlIGNvbW1vbiBwcmVmaXggb2YgdHdvIHN0cmluZ3MuXG4gICAqIEBwYXJhbSAgdGV4dDEgRmlyc3Qgc3RyaW5nLlxuICAgKiBAcGFyYW0gIHRleHQyIFNlY29uZCBzdHJpbmcuXG4gICAqIEByZXR1cm4gIFRoZSBudW1iZXIgb2YgY2hhcmFjdGVycyBjb21tb24gdG8gdGhlIHN0YXJ0IG9mIGVhY2hcbiAgICogICAgIHN0cmluZy5cbiAgICovXG4gICAgZGlmZl9jb21tb25QcmVmaXggKHRleHQxOiBzdHJpbmcsIHRleHQyOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIC8vIFF1aWNrIGNoZWNrIGZvciBjb21tb24gbnVsbCBjYXNlcy5cbiAgICBpZiAoIXRleHQxIHx8ICF0ZXh0MiB8fCB0ZXh0MS5jaGFyQXQoMCkgIT0gdGV4dDIuY2hhckF0KDApKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gICAgLy8gQmluYXJ5IHNlYXJjaC5cbiAgICAvLyBQZXJmb3JtYW5jZSBhbmFseXNpczogaHR0cDovL25laWwuZnJhc2VyLm5hbWUvbmV3cy8yMDA3LzEwLzA5L1xuICAgIGxldCBwb2ludGVybWluID0gMDtcbiAgICBsZXQgcG9pbnRlcm1heCA9IE1hdGgubWluKHRleHQxLmxlbmd0aCwgdGV4dDIubGVuZ3RoKTtcbiAgICBsZXQgcG9pbnRlcm1pZCA9IHBvaW50ZXJtYXg7XG4gICAgbGV0IHBvaW50ZXJzdGFydCA9IDA7XG4gICAgd2hpbGUgKHBvaW50ZXJtaW4gPCBwb2ludGVybWlkKSB7XG4gICAgICBpZiAodGV4dDEuc3Vic3RyaW5nKHBvaW50ZXJzdGFydCwgcG9pbnRlcm1pZCkgPT1cbiAgICAgICAgICB0ZXh0Mi5zdWJzdHJpbmcocG9pbnRlcnN0YXJ0LCBwb2ludGVybWlkKSkge1xuICAgICAgICBwb2ludGVybWluID0gcG9pbnRlcm1pZDtcbiAgICAgICAgcG9pbnRlcnN0YXJ0ID0gcG9pbnRlcm1pbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBvaW50ZXJtYXggPSBwb2ludGVybWlkO1xuICAgICAgfVxuICAgICAgcG9pbnRlcm1pZCA9IE1hdGguZmxvb3IoKHBvaW50ZXJtYXggLSBwb2ludGVybWluKSAvIDIgKyBwb2ludGVybWluKTtcbiAgICB9XG4gICAgcmV0dXJuIHBvaW50ZXJtaWQ7XG4gIH07XG5cblxuICAvKipcbiAgICogRGV0ZXJtaW5lIHRoZSBjb21tb24gc3VmZml4IG9mIHR3byBzdHJpbmdzLlxuICAgKiBAcGFyYW0gIHRleHQxIEZpcnN0IHN0cmluZy5cbiAgICogQHBhcmFtICB0ZXh0MiBTZWNvbmQgc3RyaW5nLlxuICAgKiBAcmV0dXJuICBUaGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgY29tbW9uIHRvIHRoZSBlbmQgb2YgZWFjaCBzdHJpbmcuXG4gICAqL1xuICAgIGRpZmZfY29tbW9uU3VmZml4ICh0ZXh0MTogc3RyaW5nLCB0ZXh0Mjogc3RyaW5nKTogbnVtYmVyIHtcbiAgICAvLyBRdWljayBjaGVjayBmb3IgY29tbW9uIG51bGwgY2FzZXMuXG4gICAgaWYgKCF0ZXh0MSB8fCAhdGV4dDIgfHxcbiAgICAgICAgdGV4dDEuY2hhckF0KHRleHQxLmxlbmd0aCAtIDEpICE9IHRleHQyLmNoYXJBdCh0ZXh0Mi5sZW5ndGggLSAxKSkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIC8vIEJpbmFyeSBzZWFyY2guXG4gICAgLy8gUGVyZm9ybWFuY2UgYW5hbHlzaXM6IGh0dHA6Ly9uZWlsLmZyYXNlci5uYW1lL25ld3MvMjAwNy8xMC8wOS9cbiAgICBsZXQgcG9pbnRlcm1pbiA9IDA7XG4gICAgbGV0IHBvaW50ZXJtYXggPSBNYXRoLm1pbih0ZXh0MS5sZW5ndGgsIHRleHQyLmxlbmd0aCk7XG4gICAgbGV0IHBvaW50ZXJtaWQgPSBwb2ludGVybWF4O1xuICAgIGxldCBwb2ludGVyZW5kID0gMDtcbiAgICB3aGlsZSAocG9pbnRlcm1pbiA8IHBvaW50ZXJtaWQpIHtcbiAgICAgIGlmICh0ZXh0MS5zdWJzdHJpbmcodGV4dDEubGVuZ3RoIC0gcG9pbnRlcm1pZCwgdGV4dDEubGVuZ3RoIC0gcG9pbnRlcmVuZCkgPT1cbiAgICAgICAgICB0ZXh0Mi5zdWJzdHJpbmcodGV4dDIubGVuZ3RoIC0gcG9pbnRlcm1pZCwgdGV4dDIubGVuZ3RoIC0gcG9pbnRlcmVuZCkpIHtcbiAgICAgICAgcG9pbnRlcm1pbiA9IHBvaW50ZXJtaWQ7XG4gICAgICAgIHBvaW50ZXJlbmQgPSBwb2ludGVybWluO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcG9pbnRlcm1heCA9IHBvaW50ZXJtaWQ7XG4gICAgICB9XG4gICAgICBwb2ludGVybWlkID0gTWF0aC5mbG9vcigocG9pbnRlcm1heCAtIHBvaW50ZXJtaW4pIC8gMiArIHBvaW50ZXJtaW4pO1xuICAgIH1cbiAgICByZXR1cm4gcG9pbnRlcm1pZDtcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBEZXRlcm1pbmUgaWYgdGhlIHN1ZmZpeCBvZiBvbmUgc3RyaW5nIGlzIHRoZSBwcmVmaXggb2YgYW5vdGhlci5cbiAgICogQHBhcmFtICB0ZXh0MSBGaXJzdCBzdHJpbmcuXG4gICAqIEBwYXJhbSAgdGV4dDIgU2Vjb25kIHN0cmluZy5cbiAgICogQHJldHVybiAgVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGNvbW1vbiB0byB0aGUgZW5kIG9mIHRoZSBmaXJzdFxuICAgKiAgICAgc3RyaW5nIGFuZCB0aGUgc3RhcnQgb2YgdGhlIHNlY29uZCBzdHJpbmcuXG5cbiAgICovXG4gICAgZGlmZl9jb21tb25PdmVybGFwXyAodGV4dDE6IHN0cmluZywgdGV4dDI6IHN0cmluZyk6IG51bWJlciB7XG4gICAgLy8gQ2FjaGUgdGhlIHRleHQgbGVuZ3RocyB0byBwcmV2ZW50IG11bHRpcGxlIGNhbGxzLlxuICAgIGNvbnN0IHRleHQxX2xlbmd0aCA9IHRleHQxLmxlbmd0aDtcbiAgICBjb25zdCB0ZXh0Ml9sZW5ndGggPSB0ZXh0Mi5sZW5ndGg7XG4gICAgLy8gRWxpbWluYXRlIHRoZSBudWxsIGNhc2UuXG4gICAgaWYgKHRleHQxX2xlbmd0aCA9PSAwIHx8IHRleHQyX2xlbmd0aCA9PSAwKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gICAgLy8gVHJ1bmNhdGUgdGhlIGxvbmdlciBzdHJpbmcuXG4gICAgaWYgKHRleHQxX2xlbmd0aCA+IHRleHQyX2xlbmd0aCkge1xuICAgICAgdGV4dDEgPSB0ZXh0MS5zdWJzdHJpbmcodGV4dDFfbGVuZ3RoIC0gdGV4dDJfbGVuZ3RoKTtcbiAgICB9IGVsc2UgaWYgKHRleHQxX2xlbmd0aCA8IHRleHQyX2xlbmd0aCkge1xuICAgICAgdGV4dDIgPSB0ZXh0Mi5zdWJzdHJpbmcoMCwgdGV4dDFfbGVuZ3RoKTtcbiAgICB9XG4gICAgY29uc3QgdGV4dF9sZW5ndGggPSBNYXRoLm1pbih0ZXh0MV9sZW5ndGgsIHRleHQyX2xlbmd0aCk7XG4gICAgLy8gUXVpY2sgY2hlY2sgZm9yIHRoZSB3b3JzdCBjYXNlLlxuICAgIGlmICh0ZXh0MSA9PSB0ZXh0Mikge1xuICAgICAgcmV0dXJuIHRleHRfbGVuZ3RoO1xuICAgIH1cblxuICAgIC8vIFN0YXJ0IGJ5IGxvb2tpbmcgZm9yIGEgc2luZ2xlIGNoYXJhY3RlciBtYXRjaFxuICAgIC8vIGFuZCBpbmNyZWFzZSBsZW5ndGggdW50aWwgbm8gbWF0Y2ggaXMgZm91bmQuXG4gICAgLy8gUGVyZm9ybWFuY2UgYW5hbHlzaXM6IGh0dHA6Ly9uZWlsLmZyYXNlci5uYW1lL25ld3MvMjAxMC8xMS8wNC9cbiAgICBsZXQgYmVzdCA9IDA7XG4gICAgbGV0IGxlbmd0aCA9IDE7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IHBhdHRlcm4gPSB0ZXh0MS5zdWJzdHJpbmcodGV4dF9sZW5ndGggLSBsZW5ndGgpO1xuICAgICAgY29uc3QgZm91bmQgPSB0ZXh0Mi5pbmRleE9mKHBhdHRlcm4pO1xuICAgICAgaWYgKGZvdW5kID09IC0xKSB7XG4gICAgICAgIHJldHVybiBiZXN0O1xuICAgICAgfVxuICAgICAgbGVuZ3RoICs9IGZvdW5kO1xuICAgICAgaWYgKGZvdW5kID09IDAgfHwgdGV4dDEuc3Vic3RyaW5nKHRleHRfbGVuZ3RoIC0gbGVuZ3RoKSA9PVxuICAgICAgICAgIHRleHQyLnN1YnN0cmluZygwLCBsZW5ndGgpKSB7XG4gICAgICAgIGJlc3QgPSBsZW5ndGg7XG4gICAgICAgIGxlbmd0aCsrO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuXG4gIC8qKlxuICAgKiBEbyB0aGUgdHdvIHRleHRzIHNoYXJlIGEgc3Vic3RyaW5nIHdoaWNoIGlzIGF0IGxlYXN0IGhhbGYgdGhlIGxlbmd0aCBvZiB0aGVcbiAgICogbG9uZ2VyIHRleHQ/XG4gICAqIFRoaXMgc3BlZWR1cCBjYW4gcHJvZHVjZSBub24tbWluaW1hbCBkaWZmcy5cbiAgICogQHBhcmFtICB0ZXh0MSBGaXJzdCBzdHJpbmcuXG4gICAqIEBwYXJhbSAgdGV4dDIgU2Vjb25kIHN0cmluZy5cbiAgICogQHJldHVybiAgRml2ZSBlbGVtZW50IEFycmF5LCBjb250YWluaW5nIHRoZSBwcmVmaXggb2ZcbiAgICogICAgIHRleHQxLCB0aGUgc3VmZml4IG9mIHRleHQxLCB0aGUgcHJlZml4IG9mIHRleHQyLCB0aGUgc3VmZml4IG9mXG4gICAqICAgICB0ZXh0MiBhbmQgdGhlIGNvbW1vbiBtaWRkbGUuICBPciBudWxsIGlmIHRoZXJlIHdhcyBubyBtYXRjaC5cblxuICAgKi9cbiAgICBkaWZmX2hhbGZNYXRjaF8gKHRleHQxOiBzdHJpbmcsIHRleHQyOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5EaWZmX1RpbWVvdXQgPD0gMCkge1xuICAgICAgLy8gRG9uJ3QgcmlzayByZXR1cm5pbmcgYSBub24tb3B0aW1hbCBkaWZmIGlmIHdlIGhhdmUgdW5saW1pdGVkIHRpbWUuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgbG9uZ3RleHQgPSB0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGggPyB0ZXh0MSA6IHRleHQyO1xuICAgIGNvbnN0IHNob3J0dGV4dCA9IHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCA/IHRleHQyIDogdGV4dDE7XG4gICAgaWYgKGxvbmd0ZXh0Lmxlbmd0aCA8IDQgfHwgc2hvcnR0ZXh0Lmxlbmd0aCAqIDIgPCBsb25ndGV4dC5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBudWxsOyAgLy8gUG9pbnRsZXNzLlxuICAgIH1cbiAgICBjb25zdCBkbXAgPSB0aGlzOyAgLy8gJ3RoaXMnIGJlY29tZXMgJ3dpbmRvdycgaW4gYSBjbG9zdXJlLlxuXG5cbiAgICAvLyBGaXJzdCBjaGVjayBpZiB0aGUgc2Vjb25kIHF1YXJ0ZXIgaXMgdGhlIHNlZWQgZm9yIGEgaGFsZi1tYXRjaC5cbiAgICBjb25zdCBobTEgPSB0aGlzLmRpZmZfaGFsZk1hdGNoSV8obG9uZ3RleHQsIHNob3J0dGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGguY2VpbChsb25ndGV4dC5sZW5ndGggLyA0KSwgZG1wKTtcbiAgICAvLyBDaGVjayBhZ2FpbiBiYXNlZCBvbiB0aGUgdGhpcmQgcXVhcnRlci5cbiAgICBjb25zdCBobTIgPSB0aGlzLmRpZmZfaGFsZk1hdGNoSV8obG9uZ3RleHQsIHNob3J0dGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGguY2VpbChsb25ndGV4dC5sZW5ndGggLyAyKSwgZG1wKTtcbiAgICBsZXQgaG07XG4gICAgaWYgKCFobTEgJiYgIWhtMikge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICghaG0yKSB7XG4gICAgICBobSA9IGhtMTtcbiAgICB9IGVsc2UgaWYgKCFobTEpIHtcbiAgICAgIGhtID0gaG0yO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBCb3RoIG1hdGNoZWQuICBTZWxlY3QgdGhlIGxvbmdlc3QuXG4gICAgICBobSA9IGhtMVs0XS5sZW5ndGggPiBobTJbNF0ubGVuZ3RoID8gaG0xIDogaG0yO1xuICAgIH1cblxuICAgIC8vIEEgaGFsZi1tYXRjaCB3YXMgZm91bmQsIHNvcnQgb3V0IHRoZSByZXR1cm4gZGF0YS5cbiAgICBsZXQgdGV4dDFfYSwgdGV4dDFfYiwgdGV4dDJfYSwgdGV4dDJfYjtcbiAgICBpZiAodGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoKSB7XG4gICAgICB0ZXh0MV9hID0gaG1bMF07XG4gICAgICB0ZXh0MV9iID0gaG1bMV07XG4gICAgICB0ZXh0Ml9hID0gaG1bMl07XG4gICAgICB0ZXh0Ml9iID0gaG1bM107XG4gICAgfSBlbHNlIHtcbiAgICAgIHRleHQyX2EgPSBobVswXTtcbiAgICAgIHRleHQyX2IgPSBobVsxXTtcbiAgICAgIHRleHQxX2EgPSBobVsyXTtcbiAgICAgIHRleHQxX2IgPSBobVszXTtcbiAgICB9XG4gICAgY29uc3QgbWlkX2NvbW1vbiA9IGhtWzRdO1xuICAgIHJldHVybiBbdGV4dDFfYSwgdGV4dDFfYiwgdGV4dDJfYSwgdGV4dDJfYiwgbWlkX2NvbW1vbl07XG4gIH07XG5cbiAgLyoqXG4gICAqIERvZXMgYSBzdWJzdHJpbmcgb2Ygc2hvcnR0ZXh0IGV4aXN0IHdpdGhpbiBsb25ndGV4dCBzdWNoIHRoYXQgdGhlIHN1YnN0cmluZ1xuICAgKiBpcyBhdCBsZWFzdCBoYWxmIHRoZSBsZW5ndGggb2YgbG9uZ3RleHQ/XG4gICAqIENsb3N1cmUsIGJ1dCBkb2VzIG5vdCByZWZlcmVuY2UgYW55IGV4dGVybmFsIGNvbnN0aWFibGVzLlxuICAgKiBAcGFyYW0gIGxvbmd0ZXh0IExvbmdlciBzdHJpbmcuXG4gICAqIEBwYXJhbSAgc2hvcnR0ZXh0IFNob3J0ZXIgc3RyaW5nLlxuICAgKiBAcGFyYW0gIGkgU3RhcnQgaW5kZXggb2YgcXVhcnRlciBsZW5ndGggc3Vic3RyaW5nIHdpdGhpbiBsb25ndGV4dC5cbiAgICogQHJldHVybiAgRml2ZSBlbGVtZW50IEFycmF5LCBjb250YWluaW5nIHRoZSBwcmVmaXggb2ZcbiAgICogICAgIGxvbmd0ZXh0LCB0aGUgc3VmZml4IG9mIGxvbmd0ZXh0LCB0aGUgcHJlZml4IG9mIHNob3J0dGV4dCwgdGhlIHN1ZmZpeFxuICAgKiAgICAgb2Ygc2hvcnR0ZXh0IGFuZCB0aGUgY29tbW9uIG1pZGRsZS4gIE9yIG51bGwgaWYgdGhlcmUgd2FzIG5vIG1hdGNoLlxuXG4gICAqL1xuICBkaWZmX2hhbGZNYXRjaElfKGxvbmd0ZXh0OiBzdHJpbmcsIHNob3J0dGV4dDogc3RyaW5nLCBpOiBudW1iZXIsIGRtcDogRGlmZk1hdGNoUGF0Y2gpOiBBcnJheTxzdHJpbmc+IHtcbiAgICAvLyBTdGFydCB3aXRoIGEgMS80IGxlbmd0aCBzdWJzdHJpbmcgYXQgcG9zaXRpb24gaSBhcyBhIHNlZWQuXG4gICAgY29uc3Qgc2VlZCA9IGxvbmd0ZXh0LnN1YnN0cmluZyhpLCBpICsgTWF0aC5mbG9vcihsb25ndGV4dC5sZW5ndGggLyA0KSk7XG4gICAgbGV0IGogPSAtMTtcbiAgICBsZXQgYmVzdF9jb21tb24gPSAnJztcbiAgICBsZXQgYmVzdF9sb25ndGV4dF9hLCBiZXN0X2xvbmd0ZXh0X2IsIGJlc3Rfc2hvcnR0ZXh0X2EsIGJlc3Rfc2hvcnR0ZXh0X2I7XG4gICAgd2hpbGUgKChqID0gc2hvcnR0ZXh0LmluZGV4T2Yoc2VlZCwgaiArIDEpKSAhPSAtMSkge1xuICAgICAgY29uc3QgcHJlZml4TGVuZ3RoID0gZG1wLmRpZmZfY29tbW9uUHJlZml4KGxvbmd0ZXh0LnN1YnN0cmluZyhpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG9ydHRleHQuc3Vic3RyaW5nKGopKTtcbiAgICAgIGNvbnN0IHN1ZmZpeExlbmd0aCA9IGRtcC5kaWZmX2NvbW1vblN1ZmZpeChsb25ndGV4dC5zdWJzdHJpbmcoMCwgaSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvcnR0ZXh0LnN1YnN0cmluZygwLCBqKSk7XG4gICAgICBpZiAoYmVzdF9jb21tb24ubGVuZ3RoIDwgc3VmZml4TGVuZ3RoICsgcHJlZml4TGVuZ3RoKSB7XG4gICAgICAgIGJlc3RfY29tbW9uID0gc2hvcnR0ZXh0LnN1YnN0cmluZyhqIC0gc3VmZml4TGVuZ3RoLCBqKSArXG4gICAgICAgICAgICBzaG9ydHRleHQuc3Vic3RyaW5nKGosIGogKyBwcmVmaXhMZW5ndGgpO1xuICAgICAgICBiZXN0X2xvbmd0ZXh0X2EgPSBsb25ndGV4dC5zdWJzdHJpbmcoMCwgaSAtIHN1ZmZpeExlbmd0aCk7XG4gICAgICAgIGJlc3RfbG9uZ3RleHRfYiA9IGxvbmd0ZXh0LnN1YnN0cmluZyhpICsgcHJlZml4TGVuZ3RoKTtcbiAgICAgICAgYmVzdF9zaG9ydHRleHRfYSA9IHNob3J0dGV4dC5zdWJzdHJpbmcoMCwgaiAtIHN1ZmZpeExlbmd0aCk7XG4gICAgICAgIGJlc3Rfc2hvcnR0ZXh0X2IgPSBzaG9ydHRleHQuc3Vic3RyaW5nKGogKyBwcmVmaXhMZW5ndGgpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYmVzdF9jb21tb24ubGVuZ3RoICogMiA+PSBsb25ndGV4dC5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBbYmVzdF9sb25ndGV4dF9hLCBiZXN0X2xvbmd0ZXh0X2IsXG4gICAgICAgICAgICAgIGJlc3Rfc2hvcnR0ZXh0X2EsIGJlc3Rfc2hvcnR0ZXh0X2IsIGJlc3RfY29tbW9uXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlZHVjZSB0aGUgbnVtYmVyIG9mIGVkaXRzIGJ5IGVsaW1pbmF0aW5nIHNlbWFudGljYWxseSB0cml2aWFsIGVxdWFsaXRpZXMuXG4gICAqIEBwYXJhbSAgZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gICAqL1xuICAgIGRpZmZfY2xlYW51cFNlbWFudGljIChkaWZmczogQXJyYXk8RGlmZj4pIHtcbiAgICBsZXQgY2hhbmdlcyA9IGZhbHNlO1xuICAgIGNvbnN0IGVxdWFsaXRpZXMgPSBbXTsgIC8vIFN0YWNrIG9mIGluZGljZXMgd2hlcmUgZXF1YWxpdGllcyBhcmUgZm91bmQuXG4gICAgbGV0IGVxdWFsaXRpZXNMZW5ndGggPSAwOyAgLy8gS2VlcGluZyBvdXIgb3duIGxlbmd0aCBjb25zdCBpcyBmYXN0ZXIgaW4gSlMuXG5cbiAgICBsZXQgbGFzdGVxdWFsaXR5ID0gbnVsbDtcbiAgICAvLyBBbHdheXMgZXF1YWwgdG8gZGlmZnNbZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV1dWzFdXG4gICAgbGV0IHBvaW50ZXIgPSAwOyAgLy8gSW5kZXggb2YgY3VycmVudCBwb3NpdGlvbi5cbiAgICAvLyBOdW1iZXIgb2YgY2hhcmFjdGVycyB0aGF0IGNoYW5nZWQgcHJpb3IgdG8gdGhlIGVxdWFsaXR5LlxuICAgIGxldCBsZW5ndGhfaW5zZXJ0aW9uczEgPSAwO1xuICAgIGxldCBsZW5ndGhfZGVsZXRpb25zMSA9IDA7XG4gICAgLy8gTnVtYmVyIG9mIGNoYXJhY3RlcnMgdGhhdCBjaGFuZ2VkIGFmdGVyIHRoZSBlcXVhbGl0eS5cbiAgICBsZXQgbGVuZ3RoX2luc2VydGlvbnMyID0gMDtcbiAgICBsZXQgbGVuZ3RoX2RlbGV0aW9uczIgPSAwO1xuICAgIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoKSB7XG4gICAgICBpZiAoZGlmZnNbcG9pbnRlcl1bMF0gPT0gRGlmZk9wLkVxdWFsKSB7ICAvLyBFcXVhbGl0eSBmb3VuZC5cbiAgICAgICAgZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoKytdID0gcG9pbnRlcjtcbiAgICAgICAgbGVuZ3RoX2luc2VydGlvbnMxID0gbGVuZ3RoX2luc2VydGlvbnMyO1xuICAgICAgICBsZW5ndGhfZGVsZXRpb25zMSA9IGxlbmd0aF9kZWxldGlvbnMyO1xuICAgICAgICBsZW5ndGhfaW5zZXJ0aW9uczIgPSAwO1xuICAgICAgICBsZW5ndGhfZGVsZXRpb25zMiA9IDA7XG4gICAgICAgIGxhc3RlcXVhbGl0eSA9IGRpZmZzW3BvaW50ZXJdWzFdO1xuICAgICAgfSBlbHNlIHsgIC8vIEFuIGluc2VydGlvbiBvciBkZWxldGlvbi5cbiAgICAgICAgaWYgKGRpZmZzW3BvaW50ZXJdWzBdID09IERpZmZPcC5JbnNlcnQpIHtcbiAgICAgICAgICBsZW5ndGhfaW5zZXJ0aW9uczIgKz0gZGlmZnNbcG9pbnRlcl1bMV0ubGVuZ3RoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxlbmd0aF9kZWxldGlvbnMyICs9IGRpZmZzW3BvaW50ZXJdWzFdLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICAvLyBFbGltaW5hdGUgYW4gZXF1YWxpdHkgdGhhdCBpcyBzbWFsbGVyIG9yIGVxdWFsIHRvIHRoZSBlZGl0cyBvbiBib3RoXG4gICAgICAgIC8vIHNpZGVzIG9mIGl0LlxuICAgICAgICBpZiAobGFzdGVxdWFsaXR5ICYmIChsYXN0ZXF1YWxpdHkubGVuZ3RoIDw9XG4gICAgICAgICAgICBNYXRoLm1heChsZW5ndGhfaW5zZXJ0aW9uczEsIGxlbmd0aF9kZWxldGlvbnMxKSkgJiZcbiAgICAgICAgICAgIChsYXN0ZXF1YWxpdHkubGVuZ3RoIDw9IE1hdGgubWF4KGxlbmd0aF9pbnNlcnRpb25zMixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGVuZ3RoX2RlbGV0aW9uczIpKSkge1xuICAgICAgICAgIC8vIER1cGxpY2F0ZSByZWNvcmQuXG4gICAgICAgICAgZGlmZnMuc3BsaWNlKGVxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdLCAwLFxuICAgICAgICAgICAgICAgICAgICAgIFtEaWZmT3AuRGVsZXRlLCBsYXN0ZXF1YWxpdHldKTtcbiAgICAgICAgICAvLyBDaGFuZ2Ugc2Vjb25kIGNvcHkgdG8gaW5zZXJ0LlxuICAgICAgICAgIGRpZmZzW2VxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdICsgMV1bMF0gPSBEaWZmT3AuSW5zZXJ0O1xuICAgICAgICAgIC8vIFRocm93IGF3YXkgdGhlIGVxdWFsaXR5IHdlIGp1c3QgZGVsZXRlZC5cbiAgICAgICAgICBlcXVhbGl0aWVzTGVuZ3RoLS07XG4gICAgICAgICAgLy8gVGhyb3cgYXdheSB0aGUgcHJldmlvdXMgZXF1YWxpdHkgKGl0IG5lZWRzIHRvIGJlIHJlZXZhbHVhdGVkKS5cbiAgICAgICAgICBlcXVhbGl0aWVzTGVuZ3RoLS07XG4gICAgICAgICAgcG9pbnRlciA9IGVxdWFsaXRpZXNMZW5ndGggPiAwID8gZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV0gOiAtMTtcbiAgICAgICAgICBsZW5ndGhfaW5zZXJ0aW9uczEgPSAwOyAgLy8gUmVzZXQgdGhlIGNvdW50ZXJzLlxuICAgICAgICAgIGxlbmd0aF9kZWxldGlvbnMxID0gMDtcbiAgICAgICAgICBsZW5ndGhfaW5zZXJ0aW9uczIgPSAwO1xuICAgICAgICAgIGxlbmd0aF9kZWxldGlvbnMyID0gMDtcbiAgICAgICAgICBsYXN0ZXF1YWxpdHkgPSBudWxsO1xuICAgICAgICAgIGNoYW5nZXMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwb2ludGVyKys7XG4gICAgfVxuXG4gICAgLy8gTm9ybWFsaXplIHRoZSBkaWZmLlxuICAgIGlmIChjaGFuZ2VzKSB7XG4gICAgICB0aGlzLmRpZmZfY2xlYW51cE1lcmdlKGRpZmZzKTtcbiAgICB9XG4gICAgdGhpcy5kaWZmX2NsZWFudXBTZW1hbnRpY0xvc3NsZXNzKGRpZmZzKTtcblxuICAgIC8vIEZpbmQgYW55IG92ZXJsYXBzIGJldHdlZW4gZGVsZXRpb25zIGFuZCBpbnNlcnRpb25zLlxuICAgIC8vIGUuZzogPGRlbD5hYmN4eHg8L2RlbD48aW5zPnh4eGRlZjwvaW5zPlxuICAgIC8vICAgLT4gPGRlbD5hYmM8L2RlbD54eHg8aW5zPmRlZjwvaW5zPlxuICAgIC8vIGUuZzogPGRlbD54eHhhYmM8L2RlbD48aW5zPmRlZnh4eDwvaW5zPlxuICAgIC8vICAgLT4gPGlucz5kZWY8L2lucz54eHg8ZGVsPmFiYzwvZGVsPlxuICAgIC8vIE9ubHkgZXh0cmFjdCBhbiBvdmVybGFwIGlmIGl0IGlzIGFzIGJpZyBhcyB0aGUgZWRpdCBhaGVhZCBvciBiZWhpbmQgaXQuXG4gICAgcG9pbnRlciA9IDE7XG4gICAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGgpIHtcbiAgICAgIGlmIChkaWZmc1twb2ludGVyIC0gMV1bMF0gPT0gRGlmZk9wLkRlbGV0ZSAmJlxuICAgICAgICAgIGRpZmZzW3BvaW50ZXJdWzBdID09IERpZmZPcC5JbnNlcnQpIHtcbiAgICAgICAgY29uc3QgZGVsZXRpb24gPSBkaWZmc1twb2ludGVyIC0gMV1bMV07XG4gICAgICAgIGNvbnN0IGluc2VydGlvbiA9IGRpZmZzW3BvaW50ZXJdWzFdO1xuICAgICAgICBjb25zdCBvdmVybGFwX2xlbmd0aDEgPSB0aGlzLmRpZmZfY29tbW9uT3ZlcmxhcF8oZGVsZXRpb24sIGluc2VydGlvbik7XG4gICAgICAgIGNvbnN0IG92ZXJsYXBfbGVuZ3RoMiA9IHRoaXMuZGlmZl9jb21tb25PdmVybGFwXyhpbnNlcnRpb24sIGRlbGV0aW9uKTtcbiAgICAgICAgaWYgKG92ZXJsYXBfbGVuZ3RoMSA+PSBvdmVybGFwX2xlbmd0aDIpIHtcbiAgICAgICAgICBpZiAob3ZlcmxhcF9sZW5ndGgxID49IGRlbGV0aW9uLmxlbmd0aCAvIDIgfHxcbiAgICAgICAgICAgICAgb3ZlcmxhcF9sZW5ndGgxID49IGluc2VydGlvbi5sZW5ndGggLyAyKSB7XG4gICAgICAgICAgICAvLyBPdmVybGFwIGZvdW5kLiAgSW5zZXJ0IGFuIGVxdWFsaXR5IGFuZCB0cmltIHRoZSBzdXJyb3VuZGluZyBlZGl0cy5cbiAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyLCAwLFxuICAgICAgICAgICAgICAgIFtEaWZmT3AuRXF1YWwsIGluc2VydGlvbi5zdWJzdHJpbmcoMCwgb3ZlcmxhcF9sZW5ndGgxKV0pO1xuICAgICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdID1cbiAgICAgICAgICAgICAgICBkZWxldGlvbi5zdWJzdHJpbmcoMCwgZGVsZXRpb24ubGVuZ3RoIC0gb3ZlcmxhcF9sZW5ndGgxKTtcbiAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSA9IGluc2VydGlvbi5zdWJzdHJpbmcob3ZlcmxhcF9sZW5ndGgxKTtcbiAgICAgICAgICAgIHBvaW50ZXIrKztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKG92ZXJsYXBfbGVuZ3RoMiA+PSBkZWxldGlvbi5sZW5ndGggLyAyIHx8XG4gICAgICAgICAgICAgIG92ZXJsYXBfbGVuZ3RoMiA+PSBpbnNlcnRpb24ubGVuZ3RoIC8gMikge1xuICAgICAgICAgICAgLy8gUmV2ZXJzZSBvdmVybGFwIGZvdW5kLlxuICAgICAgICAgICAgLy8gSW5zZXJ0IGFuIGVxdWFsaXR5IGFuZCBzd2FwIGFuZCB0cmltIHRoZSBzdXJyb3VuZGluZyBlZGl0cy5cbiAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyLCAwLFxuICAgICAgICAgICAgICAgIFtEaWZmT3AuRXF1YWwsIGRlbGV0aW9uLnN1YnN0cmluZygwLCBvdmVybGFwX2xlbmd0aDIpXSk7XG4gICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMF0gPSBEaWZmT3AuSW5zZXJ0O1xuICAgICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdID1cbiAgICAgICAgICAgICAgICBpbnNlcnRpb24uc3Vic3RyaW5nKDAsIGluc2VydGlvbi5sZW5ndGggLSBvdmVybGFwX2xlbmd0aDIpO1xuICAgICAgICAgICAgZGlmZnNbcG9pbnRlciArIDFdWzBdID0gRGlmZk9wLkRlbGV0ZTtcbiAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSA9XG4gICAgICAgICAgICAgICAgZGVsZXRpb24uc3Vic3RyaW5nKG92ZXJsYXBfbGVuZ3RoMik7XG4gICAgICAgICAgICBwb2ludGVyKys7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHBvaW50ZXIrKztcbiAgICAgIH1cbiAgICAgIHBvaW50ZXIrKztcbiAgICB9XG4gIH07XG5cblxuICAvKipcbiAgICogTG9vayBmb3Igc2luZ2xlIGVkaXRzIHN1cnJvdW5kZWQgb24gYm90aCBzaWRlcyBieSBlcXVhbGl0aWVzXG4gICAqIHdoaWNoIGNhbiBiZSBzaGlmdGVkIHNpZGV3YXlzIHRvIGFsaWduIHRoZSBlZGl0IHRvIGEgd29yZCBib3VuZGFyeS5cbiAgICogZS5nOiBUaGUgYzxpbnM+YXQgYzwvaW5zPmFtZS4gLT4gVGhlIDxpbnM+Y2F0IDwvaW5zPmNhbWUuXG4gICAqIEBwYXJhbSAgZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gICAqL1xuICAgIGRpZmZfY2xlYW51cFNlbWFudGljTG9zc2xlc3MgKGRpZmZzOiBBcnJheTxEaWZmPikge1xuICAgIC8qKlxuICAgICAqIEdpdmVuIHR3byBzdHJpbmdzLCBjb21wdXRlIGEgc2NvcmUgcmVwcmVzZW50aW5nIHdoZXRoZXIgdGhlIGludGVybmFsXG4gICAgICogYm91bmRhcnkgZmFsbHMgb24gbG9naWNhbCBib3VuZGFyaWVzLlxuICAgICAqIFNjb3JlcyByYW5nZSBmcm9tIDYgKGJlc3QpIHRvIDAgKHdvcnN0KS5cbiAgICAgKiBDbG9zdXJlLCBidXQgZG9lcyBub3QgcmVmZXJlbmNlIGFueSBleHRlcm5hbCBjb25zdGlhYmxlcy5cbiAgICAgKiBAcGFyYW0gIG9uZSBGaXJzdCBzdHJpbmcuXG4gICAgICogQHBhcmFtICB0d28gU2Vjb25kIHN0cmluZy5cbiAgICAgKiBAcmV0dXJuICBUaGUgc2NvcmUuXG5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBkaWZmX2NsZWFudXBTZW1hbnRpY1Njb3JlXyhvbmU6IHN0cmluZywgdHdvOiBzdHJpbmcpOiBudW1iZXIge1xuICAgICAgaWYgKCFvbmUgfHwgIXR3bykge1xuICAgICAgICAvLyBFZGdlcyBhcmUgdGhlIGJlc3QuXG4gICAgICAgIHJldHVybiA2O1xuICAgICAgfVxuXG5cbiAgICAgIGNvbnN0IG5vbkFscGhhTnVtZXJpY1JlZ2V4XyA9IG5ldyBSZWdFeHAoJy9bXmEtekEtWjAtOV0vJyk7XG5cbiAgICAgIC8vIEVhY2ggcG9ydCBvZiB0aGlzIGZ1bmN0aW9uIGJlaGF2ZXMgc2xpZ2h0bHkgZGlmZmVyZW50bHkgZHVlIHRvXG4gICAgICAvLyBzdWJ0bGUgZGlmZmVyZW5jZXMgaW4gZWFjaCBsYW5ndWFnZSdzIGRlZmluaXRpb24gb2YgdGhpbmdzIGxpa2VcbiAgICAgIC8vICd3aGl0ZXNwYWNlJy4gIFNpbmNlIHRoaXMgZnVuY3Rpb24ncyBwdXJwb3NlIGlzIGxhcmdlbHkgY29zbWV0aWMsXG4gICAgICAvLyB0aGUgY2hvaWNlIGhhcyBiZWVuIG1hZGUgdG8gdXNlIGVhY2ggbGFuZ3VhZ2UncyBuYXRpdmUgZmVhdHVyZXNcbiAgICAgIC8vIHJhdGhlciB0aGFuIGZvcmNlIHRvdGFsIGNvbmZvcm1pdHkuXG4gICAgICBjb25zdCBjaGFyMSA9IG9uZS5jaGFyQXQob25lLmxlbmd0aCAtIDEpO1xuICAgICAgY29uc3QgY2hhcjIgPSB0d28uY2hhckF0KDApO1xuICAgICAgY29uc3Qgbm9uQWxwaGFOdW1lcmljMSA9IGNoYXIxLm1hdGNoKG5vbkFscGhhTnVtZXJpY1JlZ2V4Xyk7XG4gICAgICBjb25zdCBub25BbHBoYU51bWVyaWMyID0gY2hhcjIubWF0Y2gobm9uQWxwaGFOdW1lcmljUmVnZXhfKTtcbiAgICAgIGNvbnN0IHdoaXRlc3BhY2UxID0gbm9uQWxwaGFOdW1lcmljMSAmJlxuICAgICAgICAgIGNoYXIxLm1hdGNoKHRoaXMud2hpdGVzcGFjZVJlZ2V4Xyk7XG4gICAgICBjb25zdCB3aGl0ZXNwYWNlMiA9IG5vbkFscGhhTnVtZXJpYzIgJiZcbiAgICAgICAgICBjaGFyMi5tYXRjaCh0aGlzLndoaXRlc3BhY2VSZWdleF8pO1xuICAgICAgY29uc3QgbGluZUJyZWFrMSA9IHdoaXRlc3BhY2UxICYmXG4gICAgICAgICAgY2hhcjEubWF0Y2godGhpcy5saW5lYnJlYWtSZWdleF8pO1xuICAgICAgY29uc3QgbGluZUJyZWFrMiA9IHdoaXRlc3BhY2UyICYmXG4gICAgICAgICAgY2hhcjIubWF0Y2godGhpcy5saW5lYnJlYWtSZWdleF8pO1xuICAgICAgY29uc3QgYmxhbmtMaW5lMSA9IGxpbmVCcmVhazEgJiZcbiAgICAgICAgICBvbmUubWF0Y2godGhpcy5ibGFua2xpbmVFbmRSZWdleF8pO1xuICAgICAgY29uc3QgYmxhbmtMaW5lMiA9IGxpbmVCcmVhazIgJiZcbiAgICAgICAgICB0d28ubWF0Y2godGhpcy5ibGFua2xpbmVTdGFydFJlZ2V4Xyk7XG5cbiAgICAgIGlmIChibGFua0xpbmUxIHx8IGJsYW5rTGluZTIpIHtcbiAgICAgICAgLy8gRml2ZSBwb2ludHMgZm9yIGJsYW5rIGxpbmVzLlxuICAgICAgICByZXR1cm4gNTtcbiAgICAgIH0gZWxzZSBpZiAobGluZUJyZWFrMSB8fCBsaW5lQnJlYWsyKSB7XG4gICAgICAgIC8vIEZvdXIgcG9pbnRzIGZvciBsaW5lIGJyZWFrcy5cbiAgICAgICAgcmV0dXJuIDQ7XG4gICAgICB9IGVsc2UgaWYgKG5vbkFscGhhTnVtZXJpYzEgJiYgIXdoaXRlc3BhY2UxICYmIHdoaXRlc3BhY2UyKSB7XG4gICAgICAgIC8vIFRocmVlIHBvaW50cyBmb3IgZW5kIG9mIHNlbnRlbmNlcy5cbiAgICAgICAgcmV0dXJuIDM7XG4gICAgICB9IGVsc2UgaWYgKHdoaXRlc3BhY2UxIHx8IHdoaXRlc3BhY2UyKSB7XG4gICAgICAgIC8vIFR3byBwb2ludHMgZm9yIHdoaXRlc3BhY2UuXG4gICAgICAgIHJldHVybiAyO1xuICAgICAgfSBlbHNlIGlmIChub25BbHBoYU51bWVyaWMxIHx8IG5vbkFscGhhTnVtZXJpYzIpIHtcbiAgICAgICAgLy8gT25lIHBvaW50IGZvciBub24tYWxwaGFudW1lcmljLlxuICAgICAgICByZXR1cm4gMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGxldCBwb2ludGVyID0gMTtcbiAgICAvLyBJbnRlbnRpb25hbGx5IGlnbm9yZSB0aGUgZmlyc3QgYW5kIGxhc3QgZWxlbWVudCAoZG9uJ3QgbmVlZCBjaGVja2luZykuXG4gICAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGggLSAxKSB7XG4gICAgICBpZiAoZGlmZnNbcG9pbnRlciAtIDFdWzBdID09IERpZmZPcC5FcXVhbCAmJlxuICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVswXSA9PSBEaWZmT3AuRXF1YWwpIHtcbiAgICAgICAgLy8gVGhpcyBpcyBhIHNpbmdsZSBlZGl0IHN1cnJvdW5kZWQgYnkgZXF1YWxpdGllcy5cbiAgICAgICAgbGV0IGVxdWFsaXR5MSA9IGRpZmZzW3BvaW50ZXIgLSAxXVsxXTtcbiAgICAgICAgbGV0IGVkaXQgPSBkaWZmc1twb2ludGVyXVsxXTtcbiAgICAgICAgbGV0IGVxdWFsaXR5MiA9IGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcblxuICAgICAgICAvLyBGaXJzdCwgc2hpZnQgdGhlIGVkaXQgYXMgZmFyIGxlZnQgYXMgcG9zc2libGUuXG4gICAgICAgIGNvbnN0IGNvbW1vbk9mZnNldCA9IHRoaXMuZGlmZl9jb21tb25TdWZmaXgoZXF1YWxpdHkxLCBlZGl0KTtcbiAgICAgICAgaWYgKGNvbW1vbk9mZnNldCkge1xuICAgICAgICAgIGNvbnN0IGNvbW1vblN0cmluZyA9IGVkaXQuc3Vic3RyaW5nKGVkaXQubGVuZ3RoIC0gY29tbW9uT2Zmc2V0KTtcbiAgICAgICAgICBlcXVhbGl0eTEgPSBlcXVhbGl0eTEuc3Vic3RyaW5nKDAsIGVxdWFsaXR5MS5sZW5ndGggLSBjb21tb25PZmZzZXQpO1xuICAgICAgICAgIGVkaXQgPSBjb21tb25TdHJpbmcgKyBlZGl0LnN1YnN0cmluZygwLCBlZGl0Lmxlbmd0aCAtIGNvbW1vbk9mZnNldCk7XG4gICAgICAgICAgZXF1YWxpdHkyID0gY29tbW9uU3RyaW5nICsgZXF1YWxpdHkyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2Vjb25kLCBzdGVwIGNoYXJhY3RlciBieSBjaGFyYWN0ZXIgcmlnaHQsIGxvb2tpbmcgZm9yIHRoZSBiZXN0IGZpdC5cbiAgICAgICAgbGV0IGJlc3RFcXVhbGl0eTEgPSBlcXVhbGl0eTE7XG4gICAgICAgIGxldCBiZXN0RWRpdCA9IGVkaXQ7XG4gICAgICAgIGxldCBiZXN0RXF1YWxpdHkyID0gZXF1YWxpdHkyO1xuICAgICAgICBsZXQgYmVzdFNjb3JlID0gZGlmZl9jbGVhbnVwU2VtYW50aWNTY29yZV8oZXF1YWxpdHkxLCBlZGl0KSArXG4gICAgICAgICAgICBkaWZmX2NsZWFudXBTZW1hbnRpY1Njb3JlXyhlZGl0LCBlcXVhbGl0eTIpO1xuICAgICAgICB3aGlsZSAoZWRpdC5jaGFyQXQoMCkgPT09IGVxdWFsaXR5Mi5jaGFyQXQoMCkpIHtcbiAgICAgICAgICBlcXVhbGl0eTEgKz0gZWRpdC5jaGFyQXQoMCk7XG4gICAgICAgICAgZWRpdCA9IGVkaXQuc3Vic3RyaW5nKDEpICsgZXF1YWxpdHkyLmNoYXJBdCgwKTtcbiAgICAgICAgICBlcXVhbGl0eTIgPSBlcXVhbGl0eTIuc3Vic3RyaW5nKDEpO1xuICAgICAgICAgIGNvbnN0IHNjb3JlID0gZGlmZl9jbGVhbnVwU2VtYW50aWNTY29yZV8oZXF1YWxpdHkxLCBlZGl0KSArXG4gICAgICAgICAgICAgIGRpZmZfY2xlYW51cFNlbWFudGljU2NvcmVfKGVkaXQsIGVxdWFsaXR5Mik7XG4gICAgICAgICAgLy8gVGhlID49IGVuY291cmFnZXMgdHJhaWxpbmcgcmF0aGVyIHRoYW4gbGVhZGluZyB3aGl0ZXNwYWNlIG9uIGVkaXRzLlxuICAgICAgICAgIGlmIChzY29yZSA+PSBiZXN0U2NvcmUpIHtcbiAgICAgICAgICAgIGJlc3RTY29yZSA9IHNjb3JlO1xuICAgICAgICAgICAgYmVzdEVxdWFsaXR5MSA9IGVxdWFsaXR5MTtcbiAgICAgICAgICAgIGJlc3RFZGl0ID0gZWRpdDtcbiAgICAgICAgICAgIGJlc3RFcXVhbGl0eTIgPSBlcXVhbGl0eTI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRpZmZzW3BvaW50ZXIgLSAxXVsxXSAhPSBiZXN0RXF1YWxpdHkxKSB7XG4gICAgICAgICAgLy8gV2UgaGF2ZSBhbiBpbXByb3ZlbWVudCwgc2F2ZSBpdCBiYWNrIHRvIHRoZSBkaWZmLlxuICAgICAgICAgIGlmIChiZXN0RXF1YWxpdHkxKSB7XG4gICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0gPSBiZXN0RXF1YWxpdHkxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciAtIDEsIDEpO1xuICAgICAgICAgICAgcG9pbnRlci0tO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkaWZmc1twb2ludGVyXVsxXSA9IGJlc3RFZGl0O1xuICAgICAgICAgIGlmIChiZXN0RXF1YWxpdHkyKSB7XG4gICAgICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMV0gPSBiZXN0RXF1YWxpdHkyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciArIDEsIDEpO1xuICAgICAgICAgICAgcG9pbnRlci0tO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcG9pbnRlcisrO1xuICAgIH1cbiAgfTtcblxuXG4gIC8qKlxuICAgKiBSZWR1Y2UgdGhlIG51bWJlciBvZiBlZGl0cyBieSBlbGltaW5hdGluZyBvcGVyYXRpb25hbGx5IHRyaXZpYWwgZXF1YWxpdGllcy5cbiAgICogQHBhcmFtICBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAgICovXG4gICAgZGlmZl9jbGVhbnVwRWZmaWNpZW5jeSAoZGlmZnM6IEFycmF5PERpZmY+KSB7XG4gICAgbGV0IGNoYW5nZXMgPSBmYWxzZTtcbiAgICBjb25zdCBlcXVhbGl0aWVzID0gW107ICAvLyBTdGFjayBvZiBpbmRpY2VzIHdoZXJlIGVxdWFsaXRpZXMgYXJlIGZvdW5kLlxuICAgIGxldCBlcXVhbGl0aWVzTGVuZ3RoID0gMDsgIC8vIEtlZXBpbmcgb3VyIG93biBsZW5ndGggY29uc3QgaXMgZmFzdGVyIGluIEpTLlxuXG4gICAgbGV0IGxhc3RlcXVhbGl0eSA9IG51bGw7XG4gICAgLy8gQWx3YXlzIGVxdWFsIHRvIGRpZmZzW2VxdWFsaXRpZXNbZXF1YWxpdGllc0xlbmd0aCAtIDFdXVsxXVxuICAgIGxldCBwb2ludGVyID0gMDsgIC8vIEluZGV4IG9mIGN1cnJlbnQgcG9zaXRpb24uXG4gICAgLy8gSXMgdGhlcmUgYW4gaW5zZXJ0aW9uIG9wZXJhdGlvbiBiZWZvcmUgdGhlIGxhc3QgZXF1YWxpdHkuXG4gICAgbGV0IHByZV9pbnMgPSBmYWxzZTtcbiAgICAvLyBJcyB0aGVyZSBhIGRlbGV0aW9uIG9wZXJhdGlvbiBiZWZvcmUgdGhlIGxhc3QgZXF1YWxpdHkuXG4gICAgbGV0IHByZV9kZWwgPSBmYWxzZTtcbiAgICAvLyBJcyB0aGVyZSBhbiBpbnNlcnRpb24gb3BlcmF0aW9uIGFmdGVyIHRoZSBsYXN0IGVxdWFsaXR5LlxuICAgIGxldCBwb3N0X2lucyA9IGZhbHNlO1xuICAgIC8vIElzIHRoZXJlIGEgZGVsZXRpb24gb3BlcmF0aW9uIGFmdGVyIHRoZSBsYXN0IGVxdWFsaXR5LlxuICAgIGxldCBwb3N0X2RlbCA9IGZhbHNlO1xuICAgIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoKSB7XG4gICAgICBpZiAoZGlmZnNbcG9pbnRlcl1bMF0gPT0gRGlmZk9wLkVxdWFsKSB7ICAvLyBFcXVhbGl0eSBmb3VuZC5cbiAgICAgICAgaWYgKGRpZmZzW3BvaW50ZXJdWzFdLmxlbmd0aCA8IHRoaXMuRGlmZl9FZGl0Q29zdCAmJlxuICAgICAgICAgICAgKHBvc3RfaW5zIHx8IHBvc3RfZGVsKSkge1xuICAgICAgICAgIC8vIENhbmRpZGF0ZSBmb3VuZC5cbiAgICAgICAgICBlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGgrK10gPSBwb2ludGVyO1xuICAgICAgICAgIHByZV9pbnMgPSBwb3N0X2lucztcbiAgICAgICAgICBwcmVfZGVsID0gcG9zdF9kZWw7XG4gICAgICAgICAgbGFzdGVxdWFsaXR5ID0gZGlmZnNbcG9pbnRlcl1bMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gTm90IGEgY2FuZGlkYXRlLCBhbmQgY2FuIG5ldmVyIGJlY29tZSBvbmUuXG4gICAgICAgICAgZXF1YWxpdGllc0xlbmd0aCA9IDA7XG4gICAgICAgICAgbGFzdGVxdWFsaXR5ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBwb3N0X2lucyA9IHBvc3RfZGVsID0gZmFsc2U7XG4gICAgICB9IGVsc2UgeyAgLy8gQW4gaW5zZXJ0aW9uIG9yIGRlbGV0aW9uLlxuICAgICAgICBpZiAoZGlmZnNbcG9pbnRlcl1bMF0gPT0gRGlmZk9wLkRlbGV0ZSkge1xuICAgICAgICAgIHBvc3RfZGVsID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb3N0X2lucyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLypcbiAgICAgICAgKiBGaXZlIHR5cGVzIHRvIGJlIHNwbGl0OlxuICAgICAgICAqIDxpbnM+QTwvaW5zPjxkZWw+QjwvZGVsPlhZPGlucz5DPC9pbnM+PGRlbD5EPC9kZWw+XG4gICAgICAgICogPGlucz5BPC9pbnM+WDxpbnM+QzwvaW5zPjxkZWw+RDwvZGVsPlxuICAgICAgICAqIDxpbnM+QTwvaW5zPjxkZWw+QjwvZGVsPlg8aW5zPkM8L2lucz5cbiAgICAgICAgKiA8aW5zPkE8L2RlbD5YPGlucz5DPC9pbnM+PGRlbD5EPC9kZWw+XG4gICAgICAgICogPGlucz5BPC9pbnM+PGRlbD5CPC9kZWw+WDxkZWw+QzwvZGVsPlxuICAgICAgICAqL1xuICAgICAgICBpZiAobGFzdGVxdWFsaXR5ICYmICgocHJlX2lucyAmJiBwcmVfZGVsICYmIHBvc3RfaW5zICYmIHBvc3RfZGVsKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICgobGFzdGVxdWFsaXR5Lmxlbmd0aCA8IHRoaXMuRGlmZl9FZGl0Q29zdCAvIDIpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKChwcmVfaW5zPzE6MCkgKyAocHJlX2RlbD8xOjApICsgKHBvc3RfaW5zPzE6MCkgKyAocG9zdF9kZWw/MTowKSA9PSAzKSkpKSB7XG4gICAgICAgICAgLy8gRHVwbGljYXRlIHJlY29yZC5cbiAgICAgICAgICBkaWZmcy5zcGxpY2UoZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV0sIDAsXG4gICAgICAgICAgICAgICAgICAgICAgW0RpZmZPcC5EZWxldGUsIGxhc3RlcXVhbGl0eV0pO1xuICAgICAgICAgIC8vIENoYW5nZSBzZWNvbmQgY29weSB0byBpbnNlcnQuXG4gICAgICAgICAgZGlmZnNbZXF1YWxpdGllc1tlcXVhbGl0aWVzTGVuZ3RoIC0gMV0gKyAxXVswXSA9IERpZmZPcC5JbnNlcnQ7XG4gICAgICAgICAgZXF1YWxpdGllc0xlbmd0aC0tOyAgLy8gVGhyb3cgYXdheSB0aGUgZXF1YWxpdHkgd2UganVzdCBkZWxldGVkO1xuICAgICAgICAgIGxhc3RlcXVhbGl0eSA9IG51bGw7XG4gICAgICAgICAgaWYgKHByZV9pbnMgJiYgcHJlX2RlbCkge1xuICAgICAgICAgICAgLy8gTm8gY2hhbmdlcyBtYWRlIHdoaWNoIGNvdWxkIGFmZmVjdCBwcmV2aW91cyBlbnRyeSwga2VlcCBnb2luZy5cbiAgICAgICAgICAgIHBvc3RfaW5zID0gcG9zdF9kZWwgPSB0cnVlO1xuICAgICAgICAgICAgZXF1YWxpdGllc0xlbmd0aCA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVxdWFsaXRpZXNMZW5ndGgtLTsgIC8vIFRocm93IGF3YXkgdGhlIHByZXZpb3VzIGVxdWFsaXR5LlxuICAgICAgICAgICAgcG9pbnRlciA9IGVxdWFsaXRpZXNMZW5ndGggPiAwID9cbiAgICAgICAgICAgICAgICBlcXVhbGl0aWVzW2VxdWFsaXRpZXNMZW5ndGggLSAxXSA6IC0xO1xuICAgICAgICAgICAgcG9zdF9pbnMgPSBwb3N0X2RlbCA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjaGFuZ2VzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcG9pbnRlcisrO1xuICAgIH1cblxuICAgIGlmIChjaGFuZ2VzKSB7XG4gICAgICB0aGlzLmRpZmZfY2xlYW51cE1lcmdlKGRpZmZzKTtcbiAgICB9XG4gIH07XG5cblxuICAvKipcbiAgICogUmVvcmRlciBhbmQgbWVyZ2UgbGlrZSBlZGl0IHNlY3Rpb25zLiAgTWVyZ2UgZXF1YWxpdGllcy5cbiAgICogQW55IGVkaXQgc2VjdGlvbiBjYW4gbW92ZSBhcyBsb25nIGFzIGl0IGRvZXNuJ3QgY3Jvc3MgYW4gZXF1YWxpdHkuXG4gICAqIEBwYXJhbSAgZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gICAqL1xuICAgIGRpZmZfY2xlYW51cE1lcmdlIChkaWZmczogQXJyYXk8RGlmZj4pIHtcbiAgICBkaWZmcy5wdXNoKFtEaWZmT3AuRXF1YWwsICcnXSk7ICAvLyBBZGQgYSBkdW1teSBlbnRyeSBhdCB0aGUgZW5kLlxuICAgIGxldCBwb2ludGVyID0gMDtcbiAgICBsZXQgY291bnRfZGVsZXRlID0gMDtcbiAgICBsZXQgY291bnRfaW5zZXJ0ID0gMDtcbiAgICBsZXQgdGV4dF9kZWxldGUgPSAnJztcbiAgICBsZXQgdGV4dF9pbnNlcnQgPSAnJztcbiAgICBsZXQgY29tbW9ubGVuZ3RoO1xuICAgIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoKSB7XG4gICAgICBzd2l0Y2ggKGRpZmZzW3BvaW50ZXJdWzBdKSB7XG4gICAgICAgIGNhc2UgRGlmZk9wLkluc2VydDpcbiAgICAgICAgICBjb3VudF9pbnNlcnQrKztcbiAgICAgICAgICB0ZXh0X2luc2VydCArPSBkaWZmc1twb2ludGVyXVsxXTtcbiAgICAgICAgICBwb2ludGVyKys7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRGlmZk9wLkRlbGV0ZTpcbiAgICAgICAgICBjb3VudF9kZWxldGUrKztcbiAgICAgICAgICB0ZXh0X2RlbGV0ZSArPSBkaWZmc1twb2ludGVyXVsxXTtcbiAgICAgICAgICBwb2ludGVyKys7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRGlmZk9wLkVxdWFsOlxuICAgICAgICAgIC8vIFVwb24gcmVhY2hpbmcgYW4gZXF1YWxpdHksIGNoZWNrIGZvciBwcmlvciByZWR1bmRhbmNpZXMuXG4gICAgICAgICAgaWYgKGNvdW50X2RlbGV0ZSArIGNvdW50X2luc2VydCA+IDEpIHtcbiAgICAgICAgICAgIGlmIChjb3VudF9kZWxldGUgIT09IDAgJiYgY291bnRfaW5zZXJ0ICE9PSAwKSB7XG4gICAgICAgICAgICAgIC8vIEZhY3RvciBvdXQgYW55IGNvbW1vbiBwcmVmaXhpZXMuXG4gICAgICAgICAgICAgIGNvbW1vbmxlbmd0aCA9IHRoaXMuZGlmZl9jb21tb25QcmVmaXgodGV4dF9pbnNlcnQsIHRleHRfZGVsZXRlKTtcbiAgICAgICAgICAgICAgaWYgKGNvbW1vbmxlbmd0aCAhPT0gMCkge1xuICAgICAgICAgICAgICAgIGlmICgocG9pbnRlciAtIGNvdW50X2RlbGV0ZSAtIGNvdW50X2luc2VydCkgPiAwICYmXG4gICAgICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSBjb3VudF9kZWxldGUgLSBjb3VudF9pbnNlcnQgLSAxXVswXSA9PVxuICAgICAgICAgICAgICAgICAgICBEaWZmT3AuRXF1YWwpIHtcbiAgICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSBjb3VudF9kZWxldGUgLSBjb3VudF9pbnNlcnQgLSAxXVsxXSArPVxuICAgICAgICAgICAgICAgICAgICAgIHRleHRfaW5zZXJ0LnN1YnN0cmluZygwLCBjb21tb25sZW5ndGgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBkaWZmcy5zcGxpY2UoMCwgMCwgW0RpZmZPcC5FcXVhbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dF9pbnNlcnQuc3Vic3RyaW5nKDAsIGNvbW1vbmxlbmd0aCldKTtcbiAgICAgICAgICAgICAgICAgIHBvaW50ZXIrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGV4dF9pbnNlcnQgPSB0ZXh0X2luc2VydC5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICB0ZXh0X2RlbGV0ZSA9IHRleHRfZGVsZXRlLnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIEZhY3RvciBvdXQgYW55IGNvbW1vbiBzdWZmaXhpZXMuXG4gICAgICAgICAgICAgIGNvbW1vbmxlbmd0aCA9IHRoaXMuZGlmZl9jb21tb25TdWZmaXgodGV4dF9pbnNlcnQsIHRleHRfZGVsZXRlKTtcbiAgICAgICAgICAgICAgaWYgKGNvbW1vbmxlbmd0aCAhPT0gMCkge1xuICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdID0gdGV4dF9pbnNlcnQuc3Vic3RyaW5nKHRleHRfaW5zZXJ0Lmxlbmd0aCAtXG4gICAgICAgICAgICAgICAgICAgIGNvbW1vbmxlbmd0aCkgKyBkaWZmc1twb2ludGVyXVsxXTtcbiAgICAgICAgICAgICAgICB0ZXh0X2luc2VydCA9IHRleHRfaW5zZXJ0LnN1YnN0cmluZygwLCB0ZXh0X2luc2VydC5sZW5ndGggLVxuICAgICAgICAgICAgICAgICAgICBjb21tb25sZW5ndGgpO1xuICAgICAgICAgICAgICAgIHRleHRfZGVsZXRlID0gdGV4dF9kZWxldGUuc3Vic3RyaW5nKDAsIHRleHRfZGVsZXRlLmxlbmd0aCAtXG4gICAgICAgICAgICAgICAgICAgIGNvbW1vbmxlbmd0aCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIERlbGV0ZSB0aGUgb2ZmZW5kaW5nIHJlY29yZHMgYW5kIGFkZCB0aGUgbWVyZ2VkIG9uZXMuXG4gICAgICAgICAgICBpZiAoY291bnRfZGVsZXRlID09PSAwKSB7XG4gICAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gY291bnRfaW5zZXJ0LFxuICAgICAgICAgICAgICAgICAgY291bnRfZGVsZXRlICsgY291bnRfaW5zZXJ0LCBbRGlmZk9wLkluc2VydCwgdGV4dF9pbnNlcnRdKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY291bnRfaW5zZXJ0ID09PSAwKSB7XG4gICAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gY291bnRfZGVsZXRlLFxuICAgICAgICAgICAgICAgICAgY291bnRfZGVsZXRlICsgY291bnRfaW5zZXJ0LCBbRGlmZk9wLkRlbGV0ZSwgdGV4dF9kZWxldGVdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gY291bnRfZGVsZXRlIC0gY291bnRfaW5zZXJ0LFxuICAgICAgICAgICAgICAgICAgY291bnRfZGVsZXRlICsgY291bnRfaW5zZXJ0LCBbRGlmZk9wLkRlbGV0ZSwgdGV4dF9kZWxldGVdLFxuICAgICAgICAgICAgICAgICAgW0RpZmZPcC5JbnNlcnQsIHRleHRfaW5zZXJ0XSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwb2ludGVyID0gcG9pbnRlciAtIGNvdW50X2RlbGV0ZSAtIGNvdW50X2luc2VydCArXG4gICAgICAgICAgICAgICAgICAgICAgKGNvdW50X2RlbGV0ZSA/IDEgOiAwKSArIChjb3VudF9pbnNlcnQgPyAxIDogMCkgKyAxO1xuICAgICAgICAgIH0gZWxzZSBpZiAocG9pbnRlciAhPT0gMCAmJiBkaWZmc1twb2ludGVyIC0gMV1bMF0gPT0gRGlmZk9wLkVxdWFsKSB7XG4gICAgICAgICAgICAvLyBNZXJnZSB0aGlzIGVxdWFsaXR5IHdpdGggdGhlIHByZXZpb3VzIG9uZS5cbiAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXSArPSBkaWZmc1twb2ludGVyXVsxXTtcbiAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyLCAxKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9pbnRlcisrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb3VudF9pbnNlcnQgPSAwO1xuICAgICAgICAgIGNvdW50X2RlbGV0ZSA9IDA7XG4gICAgICAgICAgdGV4dF9kZWxldGUgPSAnJztcbiAgICAgICAgICB0ZXh0X2luc2VydCA9ICcnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZGlmZnNbZGlmZnMubGVuZ3RoIC0gMV1bMV0gPT09ICcnKSB7XG4gICAgICBkaWZmcy5wb3AoKTsgIC8vIFJlbW92ZSB0aGUgZHVtbXkgZW50cnkgYXQgdGhlIGVuZC5cbiAgICB9XG5cbiAgICAvLyBTZWNvbmQgcGFzczogbG9vayBmb3Igc2luZ2xlIGVkaXRzIHN1cnJvdW5kZWQgb24gYm90aCBzaWRlcyBieSBlcXVhbGl0aWVzXG4gICAgLy8gd2hpY2ggY2FuIGJlIHNoaWZ0ZWQgc2lkZXdheXMgdG8gZWxpbWluYXRlIGFuIGVxdWFsaXR5LlxuICAgIC8vIGUuZzogQTxpbnM+QkE8L2lucz5DIC0+IDxpbnM+QUI8L2lucz5BQ1xuICAgIGxldCBjaGFuZ2VzID0gZmFsc2U7XG4gICAgcG9pbnRlciA9IDE7XG4gICAgLy8gSW50ZW50aW9uYWxseSBpZ25vcmUgdGhlIGZpcnN0IGFuZCBsYXN0IGVsZW1lbnQgKGRvbid0IG5lZWQgY2hlY2tpbmcpLlxuICAgIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoIC0gMSkge1xuICAgICAgaWYgKGRpZmZzW3BvaW50ZXIgLSAxXVswXSA9PSBEaWZmT3AuRXF1YWwgJiZcbiAgICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMF0gPT0gRGlmZk9wLkVxdWFsKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgYSBzaW5nbGUgZWRpdCBzdXJyb3VuZGVkIGJ5IGVxdWFsaXRpZXMuXG4gICAgICAgIGlmIChkaWZmc1twb2ludGVyXVsxXS5zdWJzdHJpbmcoZGlmZnNbcG9pbnRlcl1bMV0ubGVuZ3RoIC1cbiAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXS5sZW5ndGgpID09IGRpZmZzW3BvaW50ZXIgLSAxXVsxXSkge1xuICAgICAgICAgIC8vIFNoaWZ0IHRoZSBlZGl0IG92ZXIgdGhlIHByZXZpb3VzIGVxdWFsaXR5LlxuICAgICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdID0gZGlmZnNbcG9pbnRlciAtIDFdWzFdICtcbiAgICAgICAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0uc3Vic3RyaW5nKDAsIGRpZmZzW3BvaW50ZXJdWzFdLmxlbmd0aCAtXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0ubGVuZ3RoKTtcbiAgICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMV0gPSBkaWZmc1twb2ludGVyIC0gMV1bMV0gKyBkaWZmc1twb2ludGVyICsgMV1bMV07XG4gICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSAxLCAxKTtcbiAgICAgICAgICBjaGFuZ2VzID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChkaWZmc1twb2ludGVyXVsxXS5zdWJzdHJpbmcoMCwgZGlmZnNbcG9pbnRlciArIDFdWzFdLmxlbmd0aCkgPT1cbiAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSkge1xuICAgICAgICAgIC8vIFNoaWZ0IHRoZSBlZGl0IG92ZXIgdGhlIG5leHQgZXF1YWxpdHkuXG4gICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdICs9IGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcbiAgICAgICAgICBkaWZmc1twb2ludGVyXVsxXSA9XG4gICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdLnN1YnN0cmluZyhkaWZmc1twb2ludGVyICsgMV1bMV0ubGVuZ3RoKSArXG4gICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcbiAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciArIDEsIDEpO1xuICAgICAgICAgIGNoYW5nZXMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwb2ludGVyKys7XG4gICAgfVxuICAgIC8vIElmIHNoaWZ0cyB3ZXJlIG1hZGUsIHRoZSBkaWZmIG5lZWRzIHJlb3JkZXJpbmcgYW5kIGFub3RoZXIgc2hpZnQgc3dlZXAuXG4gICAgaWYgKGNoYW5nZXMpIHtcbiAgICAgIHRoaXMuZGlmZl9jbGVhbnVwTWVyZ2UoZGlmZnMpO1xuICAgIH1cbiAgfTtcblxuXG4gIC8qKlxuICAgKiBsb2MgaXMgYSBsb2NhdGlvbiBpbiB0ZXh0MSwgY29tcHV0ZSBhbmQgcmV0dXJuIHRoZSBlcXVpdmFsZW50IGxvY2F0aW9uIGluXG4gICAqIHRleHQyLlxuICAgKiBlLmcuICdUaGUgY2F0JyB2cyAnVGhlIGJpZyBjYXQnLCAxLT4xLCA1LT44XG4gICAqIEBwYXJhbSAgZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gICAqIEBwYXJhbSAgbG9jIExvY2F0aW9uIHdpdGhpbiB0ZXh0MS5cbiAgICogQHJldHVybiAgTG9jYXRpb24gd2l0aGluIHRleHQyLlxuICAgKi9cbiAgICBkaWZmX3hJbmRleCAoZGlmZnM6IEFycmF5PERpZmY+LCBsb2M6IG51bWJlcik6IG51bWJlciB7XG4gICAgbGV0IGNoYXJzMSA9IDA7XG4gICAgbGV0IGNoYXJzMiA9IDA7XG4gICAgbGV0IGxhc3RfY2hhcnMxID0gMDtcbiAgICBsZXQgbGFzdF9jaGFyczIgPSAwO1xuICAgIGxldCB4O1xuICAgIGZvciAoeCA9IDA7IHggPCBkaWZmcy5sZW5ndGg7IHgrKykge1xuICAgICAgaWYgKGRpZmZzW3hdWzBdICE9PSBEaWZmT3AuSW5zZXJ0KSB7ICAvLyBFcXVhbGl0eSBvciBkZWxldGlvbi5cbiAgICAgICAgY2hhcnMxICs9IGRpZmZzW3hdWzFdLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIGlmIChkaWZmc1t4XVswXSAhPT0gRGlmZk9wLkRlbGV0ZSkgeyAgLy8gRXF1YWxpdHkgb3IgaW5zZXJ0aW9uLlxuICAgICAgICBjaGFyczIgKz0gZGlmZnNbeF1bMV0ubGVuZ3RoO1xuICAgICAgfVxuICAgICAgaWYgKGNoYXJzMSA+IGxvYykgeyAgLy8gT3ZlcnNob3QgdGhlIGxvY2F0aW9uLlxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGxhc3RfY2hhcnMxID0gY2hhcnMxO1xuICAgICAgbGFzdF9jaGFyczIgPSBjaGFyczI7XG4gICAgfVxuICAgIC8vIFdhcyB0aGUgbG9jYXRpb24gd2FzIGRlbGV0ZWQ/XG4gICAgaWYgKGRpZmZzLmxlbmd0aCAhPSB4ICYmIGRpZmZzW3hdWzBdID09PSBEaWZmT3AuRGVsZXRlKSB7XG4gICAgICByZXR1cm4gbGFzdF9jaGFyczI7XG4gICAgfVxuICAgIC8vIEFkZCB0aGUgcmVtYWluaW5nIGNoYXJhY3RlciBsZW5ndGguXG4gICAgcmV0dXJuIGxhc3RfY2hhcnMyICsgKGxvYyAtIGxhc3RfY2hhcnMxKTtcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IGEgZGlmZiBhcnJheSBpbnRvIGEgcHJldHR5IEhUTUwgcmVwb3J0LlxuICAgKiBAcGFyYW0gIGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuICAgKiBAcmV0dXJuICBIVE1MIHJlcHJlc2VudGF0aW9uLlxuICAgKi9cbiAgICBkaWZmX3ByZXR0eUh0bWwgPSBmdW5jdGlvbihkaWZmczogQXJyYXk8RGlmZj4pOiBzdHJpbmcge1xuICAgIGNvbnN0IGh0bWwgPSBbXTtcbiAgICBjb25zdCBwYXR0ZXJuX2FtcCA9IC8mL2c7XG4gICAgY29uc3QgcGF0dGVybl9sdCA9IC88L2c7XG4gICAgY29uc3QgcGF0dGVybl9ndCA9IC8+L2c7XG4gICAgY29uc3QgcGF0dGVybl9wYXJhID0gL1xcbi9nO1xuICAgIGZvciAobGV0IHggPSAwOyB4IDwgZGlmZnMubGVuZ3RoOyB4KyspIHtcbiAgICAgIGNvbnN0IG9wID0gZGlmZnNbeF1bMF07ICAgIC8vIE9wZXJhdGlvbiAoaW5zZXJ0LCBkZWxldGUsIGVxdWFsKVxuICAgICAgY29uc3QgZGF0YSA9IGRpZmZzW3hdWzFdOyAgLy8gVGV4dCBvZiBjaGFuZ2UuXG4gICAgICBjb25zdCB0ZXh0ID0gZGF0YS5yZXBsYWNlKHBhdHRlcm5fYW1wLCAnJmFtcDsnKS5yZXBsYWNlKHBhdHRlcm5fbHQsICcmbHQ7JylcbiAgICAgICAgICAucmVwbGFjZShwYXR0ZXJuX2d0LCAnJmd0OycpLnJlcGxhY2UocGF0dGVybl9wYXJhLCAnJnBhcmE7PGJyPicpO1xuICAgICAgc3dpdGNoIChvcCkge1xuICAgICAgICBjYXNlIERpZmZPcC5JbnNlcnQ6XG4gICAgICAgICAgaHRtbFt4XSA9ICc8aW5zIHN0eWxlPVwiYmFja2dyb3VuZDojZTZmZmU2O1wiPicgKyB0ZXh0ICsgJzwvaW5zPic7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRGlmZk9wLkRlbGV0ZTpcbiAgICAgICAgICBodG1sW3hdID0gJzxkZWwgc3R5bGU9XCJiYWNrZ3JvdW5kOiNmZmU2ZTY7XCI+JyArIHRleHQgKyAnPC9kZWw+JztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBEaWZmT3AuRXF1YWw6XG4gICAgICAgICAgaHRtbFt4XSA9ICc8c3Bhbj4nICsgdGV4dCArICc8L3NwYW4+JztcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGh0bWwuam9pbignJyk7XG4gIH07XG5cblxuICAvKipcbiAgICogQ29tcHV0ZSBhbmQgcmV0dXJuIHRoZSBzb3VyY2UgdGV4dCAoYWxsIGVxdWFsaXRpZXMgYW5kIGRlbGV0aW9ucykuXG4gICAqIEBwYXJhbSAgZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gICAqIEByZXR1cm4gIFNvdXJjZSB0ZXh0LlxuICAgKi9cbiAgICBkaWZmX3RleHQxIChkaWZmczogQXJyYXk8RGlmZj4pOiBzdHJpbmcge1xuICAgIGNvbnN0IHRleHQgPSBbXTtcbiAgICBmb3IgKGxldCB4ID0gMDsgeCA8IGRpZmZzLmxlbmd0aDsgeCsrKSB7XG4gICAgICBpZiAoZGlmZnNbeF1bMF0gIT09IERpZmZPcC5JbnNlcnQpIHtcbiAgICAgICAgdGV4dFt4XSA9IGRpZmZzW3hdWzFdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGV4dC5qb2luKCcnKTtcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBDb21wdXRlIGFuZCByZXR1cm4gdGhlIGRlc3RpbmF0aW9uIHRleHQgKGFsbCBlcXVhbGl0aWVzIGFuZCBpbnNlcnRpb25zKS5cbiAgICogQHBhcmFtICBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAgICogQHJldHVybiAgRGVzdGluYXRpb24gdGV4dC5cbiAgICovXG4gICAgZGlmZl90ZXh0MiAoZGlmZnM6IEFycmF5PERpZmY+KTogc3RyaW5nIHtcbiAgICBjb25zdCB0ZXh0ID0gW107XG4gICAgZm9yIChsZXQgeCA9IDA7IHggPCBkaWZmcy5sZW5ndGg7IHgrKykge1xuICAgICAgaWYgKGRpZmZzW3hdWzBdICE9PSBEaWZmT3AuRGVsZXRlKSB7XG4gICAgICAgIHRleHRbeF0gPSBkaWZmc1t4XVsxXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRleHQuam9pbignJyk7XG4gIH07XG5cblxuICAvKipcbiAgICogQ29tcHV0ZSB0aGUgTGV2ZW5zaHRlaW4gZGlzdGFuY2U7IHRoZSBudW1iZXIgb2YgaW5zZXJ0ZWQsIGRlbGV0ZWQgb3JcbiAgICogc3Vic3RpdHV0ZWQgY2hhcmFjdGVycy5cbiAgICogQHBhcmFtICBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAgICogQHJldHVybiAgTnVtYmVyIG9mIGNoYW5nZXMuXG4gICAqL1xuICAgIGRpZmZfbGV2ZW5zaHRlaW4gKGRpZmZzOiBBcnJheTxEaWZmPik6IG51bWJlciB7XG4gICAgbGV0IGxldmVuc2h0ZWluID0gMDtcbiAgICBsZXQgaW5zZXJ0aW9ucyA9IDA7XG4gICAgbGV0IGRlbGV0aW9ucyA9IDA7XG4gICAgZm9yIChsZXQgeCA9IDA7IHggPCBkaWZmcy5sZW5ndGg7IHgrKykge1xuICAgICAgY29uc3Qgb3AgPSBkaWZmc1t4XVswXTtcbiAgICAgIGNvbnN0IGRhdGEgPSBkaWZmc1t4XVsxXTtcbiAgICAgIHN3aXRjaCAob3ApIHtcbiAgICAgICAgY2FzZSBEaWZmT3AuSW5zZXJ0OlxuICAgICAgICAgIGluc2VydGlvbnMgKz0gZGF0YS5sZW5ndGg7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRGlmZk9wLkRlbGV0ZTpcbiAgICAgICAgICBkZWxldGlvbnMgKz0gZGF0YS5sZW5ndGg7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRGlmZk9wLkVxdWFsOlxuICAgICAgICAgIC8vIEEgZGVsZXRpb24gYW5kIGFuIGluc2VydGlvbiBpcyBvbmUgc3Vic3RpdHV0aW9uLlxuICAgICAgICAgIGxldmVuc2h0ZWluICs9IE1hdGgubWF4KGluc2VydGlvbnMsIGRlbGV0aW9ucyk7XG4gICAgICAgICAgaW5zZXJ0aW9ucyA9IDA7XG4gICAgICAgICAgZGVsZXRpb25zID0gMDtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgbGV2ZW5zaHRlaW4gKz0gTWF0aC5tYXgoaW5zZXJ0aW9ucywgZGVsZXRpb25zKTtcbiAgICByZXR1cm4gbGV2ZW5zaHRlaW47XG4gIH07XG5cblxuICAvKipcbiAgICogQ3J1c2ggdGhlIGRpZmYgaW50byBhbiBlbmNvZGVkIHN0cmluZyB3aGljaCBkZXNjcmliZXMgdGhlIG9wZXJhdGlvbnNcbiAgICogcmVxdWlyZWQgdG8gdHJhbnNmb3JtIHRleHQxIGludG8gdGV4dDIuXG4gICAqIEUuZy4gPTNcXHQtMlxcdCtpbmcgIC0+IEtlZXAgMyBjaGFycywgZGVsZXRlIDIgY2hhcnMsIGluc2VydCAnaW5nJy5cbiAgICogT3BlcmF0aW9ucyBhcmUgdGFiLXNlcGFyYXRlZC4gIEluc2VydGVkIHRleHQgaXMgZXNjYXBlZCB1c2luZyAleHggbm90YXRpb24uXG4gICAqIEBwYXJhbSAgZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gICAqIEByZXR1cm4gIERlbHRhIHRleHQuXG4gICAqL1xuICAgIGRpZmZfdG9EZWx0YSAoZGlmZnM6IEFycmF5PERpZmY+KTogc3RyaW5nIHtcbiAgICBjb25zdCB0ZXh0ID0gW107XG4gICAgZm9yIChsZXQgeCA9IDA7IHggPCBkaWZmcy5sZW5ndGg7IHgrKykge1xuICAgICAgc3dpdGNoIChkaWZmc1t4XVswXSkge1xuICAgICAgICBjYXNlIERpZmZPcC5JbnNlcnQ6XG4gICAgICAgICAgdGV4dFt4XSA9ICcrJyArIGVuY29kZVVSSShkaWZmc1t4XVsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRGlmZk9wLkRlbGV0ZTpcbiAgICAgICAgICB0ZXh0W3hdID0gJy0nICsgZGlmZnNbeF1bMV0ubGVuZ3RoO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIERpZmZPcC5FcXVhbDpcbiAgICAgICAgICB0ZXh0W3hdID0gJz0nICsgZGlmZnNbeF1bMV0ubGVuZ3RoO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGV4dC5qb2luKCdcXHQnKS5yZXBsYWNlKC8lMjAvZywgJyAnKTtcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBHaXZlbiB0aGUgb3JpZ2luYWwgdGV4dDEsIGFuZCBhbiBlbmNvZGVkIHN0cmluZyB3aGljaCBkZXNjcmliZXMgdGhlXG4gICAqIG9wZXJhdGlvbnMgcmVxdWlyZWQgdG8gdHJhbnNmb3JtIHRleHQxIGludG8gdGV4dDIsIGNvbXB1dGUgdGhlIGZ1bGwgZGlmZi5cbiAgICogQHBhcmFtICB0ZXh0MSBTb3VyY2Ugc3RyaW5nIGZvciB0aGUgZGlmZi5cbiAgICogQHBhcmFtICBkZWx0YSBEZWx0YSB0ZXh0LlxuICAgKiBAcmV0dXJuICBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAgICogQHRocm93cyB7IUVycm9yfSBJZiBpbnZhbGlkIGlucHV0LlxuICAgKi9cbiAgICBkaWZmX2Zyb21EZWx0YSAodGV4dDE6IHN0cmluZywgZGVsdGE6IHN0cmluZykge1xuICAgIGNvbnN0IGRpZmZzID0gW107XG4gICAgbGV0IGRpZmZzTGVuZ3RoID0gMDsgIC8vIEtlZXBpbmcgb3VyIG93biBsZW5ndGggY29uc3QgaXMgZmFzdGVyIGluIEpTLlxuICAgIGxldCBwb2ludGVyID0gMDsgIC8vIEN1cnNvciBpbiB0ZXh0MVxuICAgIGNvbnN0IHRva2VucyA9IGRlbHRhLnNwbGl0KC9cXHQvZyk7XG4gICAgZm9yIChsZXQgeCA9IDA7IHggPCB0b2tlbnMubGVuZ3RoOyB4KyspIHtcbiAgICAgIC8vIEVhY2ggdG9rZW4gYmVnaW5zIHdpdGggYSBvbmUgY2hhcmFjdGVyIHBhcmFtZXRlciB3aGljaCBzcGVjaWZpZXMgdGhlXG4gICAgICAvLyBvcGVyYXRpb24gb2YgdGhpcyB0b2tlbiAoZGVsZXRlLCBpbnNlcnQsIGVxdWFsaXR5KS5cbiAgICAgIGNvbnN0IHBhcmFtID0gdG9rZW5zW3hdLnN1YnN0cmluZygxKTtcbiAgICAgIHN3aXRjaCAodG9rZW5zW3hdLmNoYXJBdCgwKSkge1xuICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgZGlmZnNbZGlmZnNMZW5ndGgrK10gPSBbRGlmZk9wLkluc2VydCwgZGVjb2RlVVJJKHBhcmFtKV07XG4gICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgIC8vIE1hbGZvcm1lZCBVUkkgc2VxdWVuY2UuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgZXNjYXBlIGluIGRpZmZfZnJvbURlbHRhOiAnICsgcGFyYW0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgLy8gRmFsbCB0aHJvdWdoLlxuICAgICAgICBjYXNlICc9JzpcbiAgICAgICAgICBjb25zdCBuID0gcGFyc2VJbnQocGFyYW0sIDEwKTtcbiAgICAgICAgICBpZiAoaXNOYU4obikgfHwgbiA8IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBudW1iZXIgaW4gZGlmZl9mcm9tRGVsdGE6ICcgKyBwYXJhbSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHRleHQgPSB0ZXh0MS5zdWJzdHJpbmcocG9pbnRlciwgcG9pbnRlciArPSBuKTtcbiAgICAgICAgICBpZiAodG9rZW5zW3hdLmNoYXJBdCgwKSA9PSAnPScpIHtcbiAgICAgICAgICAgIGRpZmZzW2RpZmZzTGVuZ3RoKytdID0gW0RpZmZPcC5FcXVhbCwgdGV4dF07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRpZmZzW2RpZmZzTGVuZ3RoKytdID0gW0RpZmZPcC5EZWxldGUsIHRleHRdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAvLyBCbGFuayB0b2tlbnMgYXJlIG9rIChmcm9tIGEgdHJhaWxpbmcgXFx0KS5cbiAgICAgICAgICAvLyBBbnl0aGluZyBlbHNlIGlzIGFuIGVycm9yLlxuICAgICAgICAgIGlmICh0b2tlbnNbeF0pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBkaWZmIG9wZXJhdGlvbiBpbiBkaWZmX2Zyb21EZWx0YTogJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9rZW5zW3hdKTtcbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChwb2ludGVyICE9IHRleHQxLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdEZWx0YSBsZW5ndGggKCcgKyBwb2ludGVyICtcbiAgICAgICAgICAnKSBkb2VzIG5vdCBlcXVhbCBzb3VyY2UgdGV4dCBsZW5ndGggKCcgKyB0ZXh0MS5sZW5ndGggKyAnKS4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGRpZmZzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBMb2NhdGUgdGhlIGJlc3QgaW5zdGFuY2Ugb2YgJ3BhdHRlcm4nIGluICd0ZXh0JyBuZWFyICdsb2MnLlxuICAgKiBAcGFyYW0gIHRleHQgVGhlIHRleHQgdG8gc2VhcmNoLlxuICAgKiBAcGFyYW0gIHBhdHRlcm4gVGhlIHBhdHRlcm4gdG8gc2VhcmNoIGZvci5cbiAgICogQHBhcmFtICBsb2MgVGhlIGxvY2F0aW9uIHRvIHNlYXJjaCBhcm91bmQuXG4gICAqIEByZXR1cm4gIEJlc3QgbWF0Y2ggaW5kZXggb3IgLTEuXG4gICAqL1xuICAgIG1hdGNoX21haW4gKHRleHQ6IHN0cmluZywgcGF0dGVybjogc3RyaW5nLCBsb2M6IG51bWJlcik6IG51bWJlciB7XG4gICAgLy8gQ2hlY2sgZm9yIG51bGwgaW5wdXRzLlxuICAgIGlmICh0ZXh0ID09IG51bGwgfHwgcGF0dGVybiA9PSBudWxsIHx8IGxvYyA9PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ051bGwgaW5wdXQuIChtYXRjaF9tYWluKScpO1xuICAgIH1cblxuICAgIGxvYyA9IE1hdGgubWF4KDAsIE1hdGgubWluKGxvYywgdGV4dC5sZW5ndGgpKTtcbiAgICBpZiAodGV4dCA9PSBwYXR0ZXJuKSB7XG4gICAgICAvLyBTaG9ydGN1dCAocG90ZW50aWFsbHkgbm90IGd1YXJhbnRlZWQgYnkgdGhlIGFsZ29yaXRobSlcbiAgICAgIHJldHVybiAwO1xuICAgIH0gZWxzZSBpZiAoIXRleHQubGVuZ3RoKSB7XG4gICAgICAvLyBOb3RoaW5nIHRvIG1hdGNoLlxuICAgICAgcmV0dXJuIC0xO1xuICAgIH0gZWxzZSBpZiAodGV4dC5zdWJzdHJpbmcobG9jLCBsb2MgKyBwYXR0ZXJuLmxlbmd0aCkgPT0gcGF0dGVybikge1xuICAgICAgLy8gUGVyZmVjdCBtYXRjaCBhdCB0aGUgcGVyZmVjdCBzcG90ISAgKEluY2x1ZGVzIGNhc2Ugb2YgbnVsbCBwYXR0ZXJuKVxuICAgICAgcmV0dXJuIGxvYztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRG8gYSBmdXp6eSBjb21wYXJlLlxuICAgICAgcmV0dXJuIHRoaXMubWF0Y2hfYml0YXBfKHRleHQsIHBhdHRlcm4sIGxvYyk7XG4gICAgfVxuICB9O1xuXG5cbiAgLyoqXG4gICAqIExvY2F0ZSB0aGUgYmVzdCBpbnN0YW5jZSBvZiAncGF0dGVybicgaW4gJ3RleHQnIG5lYXIgJ2xvYycgdXNpbmcgdGhlXG4gICAqIEJpdGFwIGFsZ29yaXRobS5cbiAgICogQHBhcmFtICB0ZXh0IFRoZSB0ZXh0IHRvIHNlYXJjaC5cbiAgICogQHBhcmFtICBwYXR0ZXJuIFRoZSBwYXR0ZXJuIHRvIHNlYXJjaCBmb3IuXG4gICAqIEBwYXJhbSAgbG9jIFRoZSBsb2NhdGlvbiB0byBzZWFyY2ggYXJvdW5kLlxuICAgKiBAcmV0dXJuICBCZXN0IG1hdGNoIGluZGV4IG9yIC0xLlxuXG4gICAqL1xuICAgIG1hdGNoX2JpdGFwXyAodGV4dDogc3RyaW5nLCBwYXR0ZXJuOiBzdHJpbmcsIGxvYzogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBpZiAocGF0dGVybi5sZW5ndGggPiB0aGlzLk1hdGNoX01heEJpdHMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUGF0dGVybiB0b28gbG9uZyBmb3IgdGhpcyBicm93c2VyLicpO1xuICAgIH1cblxuICAgIC8vIEluaXRpYWxpc2UgdGhlIGFscGhhYmV0LlxuICAgIGNvbnN0IHMgPSB0aGlzLm1hdGNoX2FscGhhYmV0XyhwYXR0ZXJuKTtcblxuICAgIGNvbnN0IGRtcCA9IHRoaXM7ICAvLyAndGhpcycgYmVjb21lcyAnd2luZG93JyBpbiBhIGNsb3N1cmUuXG5cbiAgICAvKipcbiAgICAgKiBDb21wdXRlIGFuZCByZXR1cm4gdGhlIHNjb3JlIGZvciBhIG1hdGNoIHdpdGggZSBlcnJvcnMgYW5kIHggbG9jYXRpb24uXG4gICAgICogQWNjZXNzZXMgbG9jIGFuZCBwYXR0ZXJuIHRocm91Z2ggYmVpbmcgYSBjbG9zdXJlLlxuICAgICAqIEBwYXJhbSAgZSBOdW1iZXIgb2YgZXJyb3JzIGluIG1hdGNoLlxuICAgICAqIEBwYXJhbSAgeCBMb2NhdGlvbiBvZiBtYXRjaC5cbiAgICAgKiBAcmV0dXJuICBPdmVyYWxsIHNjb3JlIGZvciBtYXRjaCAoMC4wID0gZ29vZCwgMS4wID0gYmFkKS5cblxuICAgICAqL1xuICAgIGZ1bmN0aW9uIG1hdGNoX2JpdGFwU2NvcmVfKGU6IG51bWJlciwgeDogbnVtYmVyKTogbnVtYmVyIHtcbiAgICAgIGNvbnN0IGFjY3VyYWN5ID0gZSAvIHBhdHRlcm4ubGVuZ3RoO1xuICAgICAgY29uc3QgcHJveGltaXR5ID0gTWF0aC5hYnMobG9jIC0geCk7XG4gICAgICBpZiAoIWRtcC5NYXRjaF9EaXN0YW5jZSkge1xuICAgICAgICAvLyBEb2RnZSBkaXZpZGUgYnkgemVybyBlcnJvci5cbiAgICAgICAgcmV0dXJuIHByb3hpbWl0eSA/IDEuMCA6IGFjY3VyYWN5O1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFjY3VyYWN5ICsgKHByb3hpbWl0eSAvIGRtcC5NYXRjaF9EaXN0YW5jZSk7XG4gICAgfVxuXG4gICAgLy8gSGlnaGVzdCBzY29yZSBiZXlvbmQgd2hpY2ggd2UgZ2l2ZSB1cC5cbiAgICBsZXQgc2NvcmVfdGhyZXNob2xkID0gdGhpcy5NYXRjaF9UaHJlc2hvbGQ7XG4gICAgLy8gSXMgdGhlcmUgYSBuZWFyYnkgZXhhY3QgbWF0Y2g/IChzcGVlZHVwKVxuICAgIGxldCBiZXN0X2xvYyA9IHRleHQuaW5kZXhPZihwYXR0ZXJuLCBsb2MpO1xuICAgIGlmIChiZXN0X2xvYyAhPSAtMSkge1xuICAgICAgc2NvcmVfdGhyZXNob2xkID0gTWF0aC5taW4obWF0Y2hfYml0YXBTY29yZV8oMCwgYmVzdF9sb2MpLCBzY29yZV90aHJlc2hvbGQpO1xuICAgICAgLy8gV2hhdCBhYm91dCBpbiB0aGUgb3RoZXIgZGlyZWN0aW9uPyAoc3BlZWR1cClcbiAgICAgIGJlc3RfbG9jID0gdGV4dC5sYXN0SW5kZXhPZihwYXR0ZXJuLCBsb2MgKyBwYXR0ZXJuLmxlbmd0aCk7XG4gICAgICBpZiAoYmVzdF9sb2MgIT0gLTEpIHtcbiAgICAgICAgc2NvcmVfdGhyZXNob2xkID1cbiAgICAgICAgICAgIE1hdGgubWluKG1hdGNoX2JpdGFwU2NvcmVfKDAsIGJlc3RfbG9jKSwgc2NvcmVfdGhyZXNob2xkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJbml0aWFsaXNlIHRoZSBiaXQgYXJyYXlzLlxuICAgIGNvbnN0IG1hdGNobWFzayA9IDEgPDwgKHBhdHRlcm4ubGVuZ3RoIC0gMSk7XG4gICAgYmVzdF9sb2MgPSAtMTtcblxuICAgIGxldCBiaW5fbWluLCBiaW5fbWlkO1xuICAgIGxldCBiaW5fbWF4ID0gcGF0dGVybi5sZW5ndGggKyB0ZXh0Lmxlbmd0aDtcbiAgICBsZXQgbGFzdF9yZDtcbiAgICBmb3IgKGxldCBkID0gMDsgZCA8IHBhdHRlcm4ubGVuZ3RoOyBkKyspIHtcbiAgICAgIC8vIFNjYW4gZm9yIHRoZSBiZXN0IG1hdGNoOyBlYWNoIGl0ZXJhdGlvbiBhbGxvd3MgZm9yIG9uZSBtb3JlIGVycm9yLlxuICAgICAgLy8gUnVuIGEgYmluYXJ5IHNlYXJjaCB0byBkZXRlcm1pbmUgaG93IGZhciBmcm9tICdsb2MnIHdlIGNhbiBzdHJheSBhdCB0aGlzXG4gICAgICAvLyBlcnJvciBsZXZlbC5cbiAgICAgIGJpbl9taW4gPSAwO1xuICAgICAgYmluX21pZCA9IGJpbl9tYXg7XG4gICAgICB3aGlsZSAoYmluX21pbiA8IGJpbl9taWQpIHtcbiAgICAgICAgaWYgKG1hdGNoX2JpdGFwU2NvcmVfKGQsIGxvYyArIGJpbl9taWQpIDw9IHNjb3JlX3RocmVzaG9sZCkge1xuICAgICAgICAgIGJpbl9taW4gPSBiaW5fbWlkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJpbl9tYXggPSBiaW5fbWlkO1xuICAgICAgICB9XG4gICAgICAgIGJpbl9taWQgPSBNYXRoLmZsb29yKChiaW5fbWF4IC0gYmluX21pbikgLyAyICsgYmluX21pbik7XG4gICAgICB9XG4gICAgICAvLyBVc2UgdGhlIHJlc3VsdCBmcm9tIHRoaXMgaXRlcmF0aW9uIGFzIHRoZSBtYXhpbXVtIGZvciB0aGUgbmV4dC5cbiAgICAgIGJpbl9tYXggPSBiaW5fbWlkO1xuICAgICAgbGV0IHN0YXJ0ID0gTWF0aC5tYXgoMSwgbG9jIC0gYmluX21pZCArIDEpO1xuICAgICAgY29uc3QgZmluaXNoID0gTWF0aC5taW4obG9jICsgYmluX21pZCwgdGV4dC5sZW5ndGgpICsgcGF0dGVybi5sZW5ndGg7XG5cbiAgICAgIGNvbnN0IHJkID0gQXJyYXkoZmluaXNoICsgMik7XG4gICAgICByZFtmaW5pc2ggKyAxXSA9ICgxIDw8IGQpIC0gMTtcbiAgICAgIGZvciAobGV0IGogPSBmaW5pc2g7IGogPj0gc3RhcnQ7IGotLSkge1xuICAgICAgICAvLyBUaGUgYWxwaGFiZXQgKHMpIGlzIGEgc3BhcnNlIGhhc2gsIHNvIHRoZSBmb2xsb3dpbmcgbGluZSBnZW5lcmF0ZXNcbiAgICAgICAgLy8gd2FybmluZ3MuXG4gICAgICAgIGNvbnN0IGNoYXJNYXRjaCA9IHNbdGV4dC5jaGFyQXQoaiAtIDEpXTtcbiAgICAgICAgaWYgKGQgPT09IDApIHsgIC8vIEZpcnN0IHBhc3M6IGV4YWN0IG1hdGNoLlxuICAgICAgICAgIHJkW2pdID0gKChyZFtqICsgMV0gPDwgMSkgfCAxKSAmIGNoYXJNYXRjaDtcbiAgICAgICAgfSBlbHNlIHsgIC8vIFN1YnNlcXVlbnQgcGFzc2VzOiBmdXp6eSBtYXRjaC5cbiAgICAgICAgICByZFtqXSA9ICgoKHJkW2ogKyAxXSA8PCAxKSB8IDEpICYgY2hhck1hdGNoKSB8XG4gICAgICAgICAgICAgICAgICAoKChsYXN0X3JkW2ogKyAxXSB8IGxhc3RfcmRbal0pIDw8IDEpIHwgMSkgfFxuICAgICAgICAgICAgICAgICAgbGFzdF9yZFtqICsgMV07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJkW2pdICYgbWF0Y2htYXNrKSB7XG4gICAgICAgICAgY29uc3Qgc2NvcmUgPSBtYXRjaF9iaXRhcFNjb3JlXyhkLCBqIC0gMSk7XG4gICAgICAgICAgLy8gVGhpcyBtYXRjaCB3aWxsIGFsbW9zdCBjZXJ0YWlubHkgYmUgYmV0dGVyIHRoYW4gYW55IGV4aXN0aW5nIG1hdGNoLlxuICAgICAgICAgIC8vIEJ1dCBjaGVjayBhbnl3YXkuXG4gICAgICAgICAgaWYgKHNjb3JlIDw9IHNjb3JlX3RocmVzaG9sZCkge1xuICAgICAgICAgICAgLy8gVG9sZCB5b3Ugc28uXG4gICAgICAgICAgICBzY29yZV90aHJlc2hvbGQgPSBzY29yZTtcbiAgICAgICAgICAgIGJlc3RfbG9jID0gaiAtIDE7XG4gICAgICAgICAgICBpZiAoYmVzdF9sb2MgPiBsb2MpIHtcbiAgICAgICAgICAgICAgLy8gV2hlbiBwYXNzaW5nIGxvYywgZG9uJ3QgZXhjZWVkIG91ciBjdXJyZW50IGRpc3RhbmNlIGZyb20gbG9jLlxuICAgICAgICAgICAgICBzdGFydCA9IE1hdGgubWF4KDEsIDIgKiBsb2MgLSBiZXN0X2xvYyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBBbHJlYWR5IHBhc3NlZCBsb2MsIGRvd25oaWxsIGZyb20gaGVyZSBvbiBpbi5cbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBObyBob3BlIGZvciBhIChiZXR0ZXIpIG1hdGNoIGF0IGdyZWF0ZXIgZXJyb3IgbGV2ZWxzLlxuICAgICAgaWYgKG1hdGNoX2JpdGFwU2NvcmVfKGQgKyAxLCBsb2MpID4gc2NvcmVfdGhyZXNob2xkKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgbGFzdF9yZCA9IHJkO1xuICAgIH1cbiAgICByZXR1cm4gYmVzdF9sb2M7XG4gIH07XG5cblxuICAvKipcbiAgICogSW5pdGlhbGlzZSB0aGUgYWxwaGFiZXQgZm9yIHRoZSBCaXRhcCBhbGdvcml0aG0uXG4gICAqIEBwYXJhbSAgcGF0dGVybiBUaGUgdGV4dCB0byBlbmNvZGUuXG4gICAqIEByZXR1cm4gIEhhc2ggb2YgY2hhcmFjdGVyIGxvY2F0aW9ucy5cblxuICAgKi9cbiAgICBtYXRjaF9hbHBoYWJldF8gKHBhdHRlcm46IHN0cmluZyk6IHsgW2NoYXJhY3Rlcjogc3RyaW5nXTogbnVtYmVyIH0ge1xuICAgIGNvbnN0IHM6IHsgW2NoYXJhY3Rlcjogc3RyaW5nXTogbnVtYmVyIH0gPSB7fTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdHRlcm4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNbcGF0dGVybi5jaGFyQXQoaSldID0gMDtcbiAgICB9XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzW3BhdHRlcm4uY2hhckF0KGkpXSB8PSAxIDw8IChwYXR0ZXJuLmxlbmd0aCAtIGkgLSAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHM7XG4gIH07XG5cblxuICAvKipcbiAgICogSW5jcmVhc2UgdGhlIGNvbnRleHQgdW50aWwgaXQgaXMgdW5pcXVlLFxuICAgKiBidXQgZG9uJ3QgbGV0IHRoZSBwYXR0ZXJuIGV4cGFuZCBiZXlvbmQgTWF0Y2hfTWF4Qml0cy5cbiAgICogQHBhcmFtICBwYXRjaCBUaGUgcGF0Y2ggdG8gZ3Jvdy5cbiAgICogQHBhcmFtICB0ZXh0IFNvdXJjZSB0ZXh0LlxuXG4gICAqL1xuICAgIHBhdGNoX2FkZENvbnRleHRfIChwYXRjaDogcGF0Y2hfb2JqLCB0ZXh0OiBzdHJpbmcpIHtcbiAgICBpZiAodGV4dC5sZW5ndGggPT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsZXQgcGF0dGVybiA9IHRleHQuc3Vic3RyaW5nKHBhdGNoLnN0YXJ0MiwgcGF0Y2guc3RhcnQyICsgcGF0Y2gubGVuZ3RoMSk7XG4gICAgbGV0IHBhZGRpbmcgPSAwO1xuXG4gICAgLy8gTG9vayBmb3IgdGhlIGZpcnN0IGFuZCBsYXN0IG1hdGNoZXMgb2YgcGF0dGVybiBpbiB0ZXh0LiAgSWYgdHdvIGRpZmZlcmVudFxuICAgIC8vIG1hdGNoZXMgYXJlIGZvdW5kLCBpbmNyZWFzZSB0aGUgcGF0dGVybiBsZW5ndGguXG4gICAgd2hpbGUgKHRleHQuaW5kZXhPZihwYXR0ZXJuKSAhPSB0ZXh0Lmxhc3RJbmRleE9mKHBhdHRlcm4pICYmXG4gICAgICAgICAgcGF0dGVybi5sZW5ndGggPCB0aGlzLk1hdGNoX01heEJpdHMgLSB0aGlzLlBhdGNoX01hcmdpbiAtXG4gICAgICAgICAgdGhpcy5QYXRjaF9NYXJnaW4pIHtcbiAgICAgIHBhZGRpbmcgKz0gdGhpcy5QYXRjaF9NYXJnaW47XG4gICAgICBwYXR0ZXJuID0gdGV4dC5zdWJzdHJpbmcocGF0Y2guc3RhcnQyIC0gcGFkZGluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGNoLnN0YXJ0MiArIHBhdGNoLmxlbmd0aDEgKyBwYWRkaW5nKTtcbiAgICB9XG4gICAgLy8gQWRkIG9uZSBjaHVuayBmb3IgZ29vZCBsdWNrLlxuICAgIHBhZGRpbmcgKz0gdGhpcy5QYXRjaF9NYXJnaW47XG5cbiAgICAvLyBBZGQgdGhlIHByZWZpeC5cbiAgICBjb25zdCBwcmVmaXggPSB0ZXh0LnN1YnN0cmluZyhwYXRjaC5zdGFydDIgLSBwYWRkaW5nLCBwYXRjaC5zdGFydDIpO1xuICAgIGlmIChwcmVmaXgpIHtcbiAgICAgIHBhdGNoLmRpZmZzLnVuc2hpZnQoW0RpZmZPcC5FcXVhbCwgcHJlZml4XSk7XG4gICAgfVxuICAgIC8vIEFkZCB0aGUgc3VmZml4LlxuICAgIGNvbnN0IHN1ZmZpeCA9IHRleHQuc3Vic3RyaW5nKHBhdGNoLnN0YXJ0MiArIHBhdGNoLmxlbmd0aDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGNoLnN0YXJ0MiArIHBhdGNoLmxlbmd0aDEgKyBwYWRkaW5nKTtcbiAgICBpZiAoc3VmZml4KSB7XG4gICAgICBwYXRjaC5kaWZmcy5wdXNoKFtEaWZmT3AuRXF1YWwsIHN1ZmZpeF0pO1xuICAgIH1cblxuICAgIC8vIFJvbGwgYmFjayB0aGUgc3RhcnQgcG9pbnRzLlxuICAgIHBhdGNoLnN0YXJ0MSAtPSBwcmVmaXgubGVuZ3RoO1xuICAgIHBhdGNoLnN0YXJ0MiAtPSBwcmVmaXgubGVuZ3RoO1xuICAgIC8vIEV4dGVuZCB0aGUgbGVuZ3Rocy5cbiAgICBwYXRjaC5sZW5ndGgxICs9IHByZWZpeC5sZW5ndGggKyBzdWZmaXgubGVuZ3RoO1xuICAgIHBhdGNoLmxlbmd0aDIgKz0gcHJlZml4Lmxlbmd0aCArIHN1ZmZpeC5sZW5ndGg7XG4gIH07XG5cblxuICAvKipcbiAgICogQ29tcHV0ZSBhIGxpc3Qgb2YgcGF0Y2hlcyB0byB0dXJuIHRleHQxIGludG8gdGV4dDIuXG4gICAqIFVzZSBkaWZmcyBpZiBwcm92aWRlZCwgb3RoZXJ3aXNlIGNvbXB1dGUgaXQgb3Vyc2VsdmVzLlxuICAgKiBUaGVyZSBhcmUgZm91ciB3YXlzIHRvIGNhbGwgdGhpcyBmdW5jdGlvbiwgZGVwZW5kaW5nIG9uIHdoYXQgZGF0YSBpc1xuICAgKiBhdmFpbGFibGUgdG8gdGhlIGNhbGxlcjpcbiAgICogTWV0aG9kIDE6XG4gICAqIGEgPSB0ZXh0MSwgYiA9IHRleHQyXG4gICAqIE1ldGhvZCAyOlxuICAgKiBhID0gZGlmZnNcbiAgICogTWV0aG9kIDMgKG9wdGltYWwpOlxuICAgKiBhID0gdGV4dDEsIGIgPSBkaWZmc1xuICAgKiBNZXRob2QgNCAoZGVwcmVjYXRlZCwgdXNlIG1ldGhvZCAzKTpcbiAgICogYSA9IHRleHQxLCBiID0gdGV4dDIsIGMgPSBkaWZmc1xuICAgKlxuICAgKiBAcGFyYW0gIGEgdGV4dDEgKG1ldGhvZHMgMSwzLDQpIG9yXG4gICAqIEFycmF5IG9mIGRpZmYgdHVwbGVzIGZvciB0ZXh0MSB0byB0ZXh0MiAobWV0aG9kIDIpLlxuICAgKiBAcGFyYW0gIG9wdF9iIHRleHQyIChtZXRob2RzIDEsNCkgb3JcbiAgICogQXJyYXkgb2YgZGlmZiB0dXBsZXMgZm9yIHRleHQxIHRvIHRleHQyIChtZXRob2QgMykgb3IgdW5kZWZpbmVkIChtZXRob2QgMikuXG4gICAqIEBwYXJhbSAgb3B0X2MgQXJyYXkgb2YgZGlmZiB0dXBsZXNcbiAgICogZm9yIHRleHQxIHRvIHRleHQyIChtZXRob2QgNCkgb3IgdW5kZWZpbmVkIChtZXRob2RzIDEsMiwzKS5cbiAgICogQHJldHVybiAgQXJyYXkgb2YgUGF0Y2ggb2JqZWN0cy5cbiAgICovXG4gICAgcGF0Y2hfbWFrZSAoYTogc3RyaW5nIHwgQXJyYXk8RGlmZj4sIG9wdF9iOiBzdHJpbmcgfCBBcnJheTxEaWZmPiwgb3B0X2M6IHN0cmluZyB8IEFycmF5PERpZmY+KSB7XG4gICAgbGV0IHRleHQxLCBkaWZmcztcbiAgICBpZiAodHlwZW9mIGEgPT0gJ3N0cmluZycgJiYgdHlwZW9mIG9wdF9iID09ICdzdHJpbmcnICYmXG4gICAgICAgIHR5cGVvZiBvcHRfYyA9PSAndW5kZWZpbmVkJykge1xuICAgICAgLy8gTWV0aG9kIDE6IHRleHQxLCB0ZXh0MlxuICAgICAgLy8gQ29tcHV0ZSBkaWZmcyBmcm9tIHRleHQxIGFuZCB0ZXh0Mi5cbiAgICAgIHRleHQxID0gKGEpO1xuICAgICAgZGlmZnMgPSB0aGlzLmRpZmZfbWFpbih0ZXh0MSwgKG9wdF9iKSwgdHJ1ZSk7XG4gICAgICBpZiAoZGlmZnMubGVuZ3RoID4gMikge1xuICAgICAgICB0aGlzLmRpZmZfY2xlYW51cFNlbWFudGljKGRpZmZzKTtcbiAgICAgICAgdGhpcy5kaWZmX2NsZWFudXBFZmZpY2llbmN5KGRpZmZzKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGEgJiYgdHlwZW9mIGEgPT0gJ29iamVjdCcgJiYgdHlwZW9mIG9wdF9iID09ICd1bmRlZmluZWQnICYmXG4gICAgICAgIHR5cGVvZiBvcHRfYyA9PSAndW5kZWZpbmVkJykge1xuICAgICAgLy8gTWV0aG9kIDI6IGRpZmZzXG4gICAgICAvLyBDb21wdXRlIHRleHQxIGZyb20gZGlmZnMuXG4gICAgICBkaWZmcyA9IChhKTtcbiAgICAgIHRleHQxID0gdGhpcy5kaWZmX3RleHQxKGRpZmZzKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBhID09ICdzdHJpbmcnICYmIG9wdF9iICYmIHR5cGVvZiBvcHRfYiA9PSAnb2JqZWN0JyAmJlxuICAgICAgICB0eXBlb2Ygb3B0X2MgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIC8vIE1ldGhvZCAzOiB0ZXh0MSwgZGlmZnNcbiAgICAgIHRleHQxID0gKGEpO1xuICAgICAgZGlmZnMgPSAob3B0X2IpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGEgPT0gJ3N0cmluZycgJiYgdHlwZW9mIG9wdF9iID09ICdzdHJpbmcnICYmXG4gICAgICAgIG9wdF9jICYmIHR5cGVvZiBvcHRfYyA9PSAnb2JqZWN0Jykge1xuICAgICAgLy8gTWV0aG9kIDQ6IHRleHQxLCB0ZXh0MiwgZGlmZnNcbiAgICAgIC8vIHRleHQyIGlzIG5vdCB1c2VkLlxuICAgICAgdGV4dDEgPSAoYSk7XG4gICAgICBkaWZmcyA9IChvcHRfYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBjYWxsIGZvcm1hdCB0byBwYXRjaF9tYWtlLicpO1xuICAgIH1cblxuICAgIGlmIChkaWZmcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBbXTsgIC8vIEdldCByaWQgb2YgdGhlIG51bGwgY2FzZS5cbiAgICB9XG4gICAgY29uc3QgcGF0Y2hlcyA9IFtdO1xuICAgIGxldCBwYXRjaCA9IG5ldyBwYXRjaF9vYmooKTtcbiAgICBsZXQgcGF0Y2hEaWZmTGVuZ3RoID0gMDsgIC8vIEtlZXBpbmcgb3VyIG93biBsZW5ndGggY29uc3QgaXMgZmFzdGVyIGluIEpTLlxuICAgIGxldCBjaGFyX2NvdW50MSA9IDA7ICAvLyBOdW1iZXIgb2YgY2hhcmFjdGVycyBpbnRvIHRoZSB0ZXh0MSBzdHJpbmcuXG4gICAgbGV0IGNoYXJfY291bnQyID0gMDsgIC8vIE51bWJlciBvZiBjaGFyYWN0ZXJzIGludG8gdGhlIHRleHQyIHN0cmluZy5cbiAgICAvLyBTdGFydCB3aXRoIHRleHQxIChwcmVwYXRjaF90ZXh0KSBhbmQgYXBwbHkgdGhlIGRpZmZzIHVudGlsIHdlIGFycml2ZSBhdFxuICAgIC8vIHRleHQyIChwb3N0cGF0Y2hfdGV4dCkuICBXZSByZWNyZWF0ZSB0aGUgcGF0Y2hlcyBvbmUgYnkgb25lIHRvIGRldGVybWluZVxuICAgIC8vIGNvbnRleHQgaW5mby5cbiAgICBsZXQgcHJlcGF0Y2hfdGV4dCA9IHRleHQxO1xuICAgIGxldCBwb3N0cGF0Y2hfdGV4dCA9IHRleHQxO1xuICAgIGZvciAobGV0IHggPSAwOyB4IDwgZGlmZnMubGVuZ3RoOyB4KyspIHtcbiAgICAgIGNvbnN0IGRpZmZfdHlwZSA9IGRpZmZzW3hdWzBdO1xuICAgICAgY29uc3QgZGlmZl90ZXh0ID0gZGlmZnNbeF1bMV07XG5cbiAgICAgIGlmICghcGF0Y2hEaWZmTGVuZ3RoICYmIGRpZmZfdHlwZSAhPT0gRGlmZk9wLkVxdWFsKSB7XG4gICAgICAgIC8vIEEgbmV3IHBhdGNoIHN0YXJ0cyBoZXJlLlxuICAgICAgICBwYXRjaC5zdGFydDEgPSBjaGFyX2NvdW50MTtcbiAgICAgICAgcGF0Y2guc3RhcnQyID0gY2hhcl9jb3VudDI7XG4gICAgICB9XG5cbiAgICAgIHN3aXRjaCAoZGlmZl90eXBlKSB7XG4gICAgICAgIGNhc2UgRGlmZk9wLkluc2VydDpcbiAgICAgICAgICBwYXRjaC5kaWZmc1twYXRjaERpZmZMZW5ndGgrK10gPSBkaWZmc1t4XTtcbiAgICAgICAgICBwYXRjaC5sZW5ndGgyICs9IGRpZmZfdGV4dC5sZW5ndGg7XG4gICAgICAgICAgcG9zdHBhdGNoX3RleHQgPSBwb3N0cGF0Y2hfdGV4dC5zdWJzdHJpbmcoMCwgY2hhcl9jb3VudDIpICsgZGlmZl90ZXh0ICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zdHBhdGNoX3RleHQuc3Vic3RyaW5nKGNoYXJfY291bnQyKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBEaWZmT3AuRGVsZXRlOlxuICAgICAgICAgIHBhdGNoLmxlbmd0aDEgKz0gZGlmZl90ZXh0Lmxlbmd0aDtcbiAgICAgICAgICBwYXRjaC5kaWZmc1twYXRjaERpZmZMZW5ndGgrK10gPSBkaWZmc1t4XTtcbiAgICAgICAgICBwb3N0cGF0Y2hfdGV4dCA9IHBvc3RwYXRjaF90ZXh0LnN1YnN0cmluZygwLCBjaGFyX2NvdW50MikgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0cGF0Y2hfdGV4dC5zdWJzdHJpbmcoY2hhcl9jb3VudDIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlmZl90ZXh0Lmxlbmd0aCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRGlmZk9wLkVxdWFsOlxuICAgICAgICAgIGlmIChkaWZmX3RleHQubGVuZ3RoIDw9IDIgKiB0aGlzLlBhdGNoX01hcmdpbiAmJlxuICAgICAgICAgICAgICBwYXRjaERpZmZMZW5ndGggJiYgZGlmZnMubGVuZ3RoICE9IHggKyAxKSB7XG4gICAgICAgICAgICAvLyBTbWFsbCBlcXVhbGl0eSBpbnNpZGUgYSBwYXRjaC5cbiAgICAgICAgICAgIHBhdGNoLmRpZmZzW3BhdGNoRGlmZkxlbmd0aCsrXSA9IGRpZmZzW3hdO1xuICAgICAgICAgICAgcGF0Y2gubGVuZ3RoMSArPSBkaWZmX3RleHQubGVuZ3RoO1xuICAgICAgICAgICAgcGF0Y2gubGVuZ3RoMiArPSBkaWZmX3RleHQubGVuZ3RoO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZGlmZl90ZXh0Lmxlbmd0aCA+PSAyICogdGhpcy5QYXRjaF9NYXJnaW4pIHtcbiAgICAgICAgICAgIC8vIFRpbWUgZm9yIGEgbmV3IHBhdGNoLlxuICAgICAgICAgICAgaWYgKHBhdGNoRGlmZkxlbmd0aCkge1xuICAgICAgICAgICAgICB0aGlzLnBhdGNoX2FkZENvbnRleHRfKHBhdGNoLCBwcmVwYXRjaF90ZXh0KTtcbiAgICAgICAgICAgICAgcGF0Y2hlcy5wdXNoKHBhdGNoKTtcbiAgICAgICAgICAgICAgcGF0Y2ggPSBuZXcgcGF0Y2hfb2JqKCk7XG4gICAgICAgICAgICAgIHBhdGNoRGlmZkxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgIC8vIFVubGlrZSBVbmlkaWZmLCBvdXIgcGF0Y2ggbGlzdHMgaGF2ZSBhIHJvbGxpbmcgY29udGV4dC5cbiAgICAgICAgICAgICAgLy8gaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL2dvb2dsZS1kaWZmLW1hdGNoLXBhdGNoL3dpa2kvVW5pZGlmZlxuICAgICAgICAgICAgICAvLyBVcGRhdGUgcHJlcGF0Y2ggdGV4dCAmIHBvcyB0byByZWZsZWN0IHRoZSBhcHBsaWNhdGlvbiBvZiB0aGVcbiAgICAgICAgICAgICAgLy8ganVzdCBjb21wbGV0ZWQgcGF0Y2guXG4gICAgICAgICAgICAgIHByZXBhdGNoX3RleHQgPSBwb3N0cGF0Y2hfdGV4dDtcbiAgICAgICAgICAgICAgY2hhcl9jb3VudDEgPSBjaGFyX2NvdW50MjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSB0aGUgY3VycmVudCBjaGFyYWN0ZXIgY291bnQuXG4gICAgICBpZiAoZGlmZl90eXBlICE9PSBEaWZmT3AuSW5zZXJ0KSB7XG4gICAgICAgIGNoYXJfY291bnQxICs9IGRpZmZfdGV4dC5sZW5ndGg7XG4gICAgICB9XG4gICAgICBpZiAoZGlmZl90eXBlICE9PSBEaWZmT3AuRGVsZXRlKSB7XG4gICAgICAgIGNoYXJfY291bnQyICs9IGRpZmZfdGV4dC5sZW5ndGg7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFBpY2sgdXAgdGhlIGxlZnRvdmVyIHBhdGNoIGlmIG5vdCBlbXB0eS5cbiAgICBpZiAocGF0Y2hEaWZmTGVuZ3RoKSB7XG4gICAgICB0aGlzLnBhdGNoX2FkZENvbnRleHRfKHBhdGNoLCBwcmVwYXRjaF90ZXh0KTtcbiAgICAgIHBhdGNoZXMucHVzaChwYXRjaCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHBhdGNoZXM7XG4gIH07XG5cblxuICAvKipcbiAgICogR2l2ZW4gYW4gYXJyYXkgb2YgcGF0Y2hlcywgcmV0dXJuIGFub3RoZXIgYXJyYXkgdGhhdCBpcyBpZGVudGljYWwuXG4gICAqIEBwYXJhbSAgcGF0Y2hlcyBBcnJheSBvZiBQYXRjaCBvYmplY3RzLlxuICAgKiBAcmV0dXJuICBBcnJheSBvZiBQYXRjaCBvYmplY3RzLlxuICAgKi9cbiAgICBwYXRjaF9kZWVwQ29weSAocGF0Y2hlczogQXJyYXk8cGF0Y2hfb2JqPik6IEFycmF5PHBhdGNoX29iaj4ge1xuICAgIC8vIE1ha2luZyBkZWVwIGNvcGllcyBpcyBoYXJkIGluIEphdmFTY3JpcHQuXG4gICAgY29uc3QgcGF0Y2hlc0NvcHkgPSBbXTtcbiAgICBmb3IgKGxldCB4ID0gMDsgeCA8IHBhdGNoZXMubGVuZ3RoOyB4KyspIHtcbiAgICAgIGNvbnN0IHBhdGNoID0gcGF0Y2hlc1t4XTtcbiAgICAgIGNvbnN0IHBhdGNoQ29weSA9IG5ldyBwYXRjaF9vYmooKTtcbiAgICAgIHBhdGNoQ29weS5kaWZmcyA9IFtdO1xuICAgICAgZm9yIChsZXQgeSA9IDA7IHkgPCBwYXRjaC5kaWZmcy5sZW5ndGg7IHkrKykge1xuICAgICAgICBwYXRjaENvcHkuZGlmZnNbeV0gPSBbcGF0Y2guZGlmZnNbeV1bMF0sIHBhdGNoLmRpZmZzW3ldWzFdXTtcbiAgICAgIH1cbiAgICAgIHBhdGNoQ29weS5zdGFydDEgPSBwYXRjaC5zdGFydDE7XG4gICAgICBwYXRjaENvcHkuc3RhcnQyID0gcGF0Y2guc3RhcnQyO1xuICAgICAgcGF0Y2hDb3B5Lmxlbmd0aDEgPSBwYXRjaC5sZW5ndGgxO1xuICAgICAgcGF0Y2hDb3B5Lmxlbmd0aDIgPSBwYXRjaC5sZW5ndGgyO1xuICAgICAgcGF0Y2hlc0NvcHlbeF0gPSBwYXRjaENvcHk7XG4gICAgfVxuICAgIHJldHVybiBwYXRjaGVzQ29weTtcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBNZXJnZSBhIHNldCBvZiBwYXRjaGVzIG9udG8gdGhlIHRleHQuICBSZXR1cm4gYSBwYXRjaGVkIHRleHQsIGFzIHdlbGxcbiAgICogYXMgYSBsaXN0IG9mIHRydWUvZmFsc2UgdmFsdWVzIGluZGljYXRpbmcgd2hpY2ggcGF0Y2hlcyB3ZXJlIGFwcGxpZWQuXG4gICAqIEBwYXJhbSAgcGF0Y2hlcyBBcnJheSBvZiBQYXRjaCBvYmplY3RzLlxuICAgKiBAcGFyYW0gIHRleHQgT2xkIHRleHQuXG4gICAqIEByZXR1cm4gIFR3byBlbGVtZW50IEFycmF5LCBjb250YWluaW5nIHRoZVxuICAgKiAgICAgIG5ldyB0ZXh0IGFuZCBhbiBhcnJheSBvZiBib29sZWFuIHZhbHVlcy5cbiAgICovXG4gICAgcGF0Y2hfYXBwbHkgKHBhdGNoZXM6IEFycmF5PHBhdGNoX29iaj4sIHRleHQ6IHN0cmluZykge1xuICAgIGlmIChwYXRjaGVzLmxlbmd0aCA9PSAwKSB7XG4gICAgICByZXR1cm4gW3RleHQsIFtdXTtcbiAgICB9XG5cbiAgICAvLyBEZWVwIGNvcHkgdGhlIHBhdGNoZXMgc28gdGhhdCBubyBjaGFuZ2VzIGFyZSBtYWRlIHRvIG9yaWdpbmFscy5cbiAgICBwYXRjaGVzID0gdGhpcy5wYXRjaF9kZWVwQ29weShwYXRjaGVzKTtcblxuICAgIGNvbnN0IG51bGxQYWRkaW5nID0gdGhpcy5wYXRjaF9hZGRQYWRkaW5nKHBhdGNoZXMpO1xuICAgIHRleHQgPSBudWxsUGFkZGluZyArIHRleHQgKyBudWxsUGFkZGluZztcblxuICAgIHRoaXMucGF0Y2hfc3BsaXRNYXgocGF0Y2hlcyk7XG4gICAgLy8gZGVsdGEga2VlcHMgdHJhY2sgb2YgdGhlIG9mZnNldCBiZXR3ZWVuIHRoZSBleHBlY3RlZCBhbmQgYWN0dWFsIGxvY2F0aW9uXG4gICAgLy8gb2YgdGhlIHByZXZpb3VzIHBhdGNoLiAgSWYgdGhlcmUgYXJlIHBhdGNoZXMgZXhwZWN0ZWQgYXQgcG9zaXRpb25zIDEwIGFuZFxuICAgIC8vIDIwLCBidXQgdGhlIGZpcnN0IHBhdGNoIHdhcyBmb3VuZCBhdCAxMiwgZGVsdGEgaXMgMiBhbmQgdGhlIHNlY29uZCBwYXRjaFxuICAgIC8vIGhhcyBhbiBlZmZlY3RpdmUgZXhwZWN0ZWQgcG9zaXRpb24gb2YgMjIuXG4gICAgbGV0IGRlbHRhID0gMDtcbiAgICBjb25zdCByZXN1bHRzID0gW107XG4gICAgZm9yIChsZXQgeCA9IDA7IHggPCBwYXRjaGVzLmxlbmd0aDsgeCsrKSB7XG4gICAgICBjb25zdCBleHBlY3RlZF9sb2MgPSBwYXRjaGVzW3hdLnN0YXJ0MiArIGRlbHRhO1xuICAgICAgY29uc3QgdGV4dDEgPSB0aGlzLmRpZmZfdGV4dDEocGF0Y2hlc1t4XS5kaWZmcyk7XG4gICAgICBsZXQgc3RhcnRfbG9jO1xuICAgICAgbGV0IGVuZF9sb2MgPSAtMTtcbiAgICAgIGlmICh0ZXh0MS5sZW5ndGggPiB0aGlzLk1hdGNoX01heEJpdHMpIHtcbiAgICAgICAgLy8gcGF0Y2hfc3BsaXRNYXggd2lsbCBvbmx5IHByb3ZpZGUgYW4gb3ZlcnNpemVkIHBhdHRlcm4gaW4gdGhlIGNhc2Ugb2ZcbiAgICAgICAgLy8gYSBtb25zdGVyIGRlbGV0ZS5cbiAgICAgICAgc3RhcnRfbG9jID0gdGhpcy5tYXRjaF9tYWluKHRleHQsIHRleHQxLnN1YnN0cmluZygwLCB0aGlzLk1hdGNoX01heEJpdHMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRfbG9jKTtcbiAgICAgICAgaWYgKHN0YXJ0X2xvYyAhPSAtMSkge1xuICAgICAgICAgIGVuZF9sb2MgPSB0aGlzLm1hdGNoX21haW4odGV4dCxcbiAgICAgICAgICAgICAgdGV4dDEuc3Vic3RyaW5nKHRleHQxLmxlbmd0aCAtIHRoaXMuTWF0Y2hfTWF4Qml0cyksXG4gICAgICAgICAgICAgIGV4cGVjdGVkX2xvYyArIHRleHQxLmxlbmd0aCAtIHRoaXMuTWF0Y2hfTWF4Qml0cyk7XG4gICAgICAgICAgaWYgKGVuZF9sb2MgPT0gLTEgfHwgc3RhcnRfbG9jID49IGVuZF9sb2MpIHtcbiAgICAgICAgICAgIC8vIENhbid0IGZpbmQgdmFsaWQgdHJhaWxpbmcgY29udGV4dC4gIERyb3AgdGhpcyBwYXRjaC5cbiAgICAgICAgICAgIHN0YXJ0X2xvYyA9IC0xO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhcnRfbG9jID0gdGhpcy5tYXRjaF9tYWluKHRleHQsIHRleHQxLCBleHBlY3RlZF9sb2MpO1xuICAgICAgfVxuICAgICAgaWYgKHN0YXJ0X2xvYyA9PSAtMSkge1xuICAgICAgICAvLyBObyBtYXRjaCBmb3VuZC4gIDooXG4gICAgICAgIHJlc3VsdHNbeF0gPSBmYWxzZTtcbiAgICAgICAgLy8gU3VidHJhY3QgdGhlIGRlbHRhIGZvciB0aGlzIGZhaWxlZCBwYXRjaCBmcm9tIHN1YnNlcXVlbnQgcGF0Y2hlcy5cbiAgICAgICAgZGVsdGEgLT0gcGF0Y2hlc1t4XS5sZW5ndGgyIC0gcGF0Y2hlc1t4XS5sZW5ndGgxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRm91bmQgYSBtYXRjaC4gIDopXG4gICAgICAgIHJlc3VsdHNbeF0gPSB0cnVlO1xuICAgICAgICBkZWx0YSA9IHN0YXJ0X2xvYyAtIGV4cGVjdGVkX2xvYztcbiAgICAgICAgbGV0IHRleHQyO1xuICAgICAgICBpZiAoZW5kX2xvYyA9PSAtMSkge1xuICAgICAgICAgIHRleHQyID0gdGV4dC5zdWJzdHJpbmcoc3RhcnRfbG9jLCBzdGFydF9sb2MgKyB0ZXh0MS5sZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRleHQyID0gdGV4dC5zdWJzdHJpbmcoc3RhcnRfbG9jLCBlbmRfbG9jICsgdGhpcy5NYXRjaF9NYXhCaXRzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGV4dDEgPT0gdGV4dDIpIHtcbiAgICAgICAgICAvLyBQZXJmZWN0IG1hdGNoLCBqdXN0IHNob3ZlIHRoZSByZXBsYWNlbWVudCB0ZXh0IGluLlxuICAgICAgICAgIHRleHQgPSB0ZXh0LnN1YnN0cmluZygwLCBzdGFydF9sb2MpICtcbiAgICAgICAgICAgICAgICB0aGlzLmRpZmZfdGV4dDIocGF0Y2hlc1t4XS5kaWZmcykgK1xuICAgICAgICAgICAgICAgIHRleHQuc3Vic3RyaW5nKHN0YXJ0X2xvYyArIHRleHQxLmxlbmd0aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gSW1wZXJmZWN0IG1hdGNoLiAgUnVuIGEgZGlmZiB0byBnZXQgYSBmcmFtZXdvcmsgb2YgZXF1aXZhbGVudFxuICAgICAgICAgIC8vIGluZGljZXMuXG4gICAgICAgICAgY29uc3QgZGlmZnMgPSB0aGlzLmRpZmZfbWFpbih0ZXh0MSwgdGV4dDIsIGZhbHNlKTtcbiAgICAgICAgICBpZiAodGV4dDEubGVuZ3RoID4gdGhpcy5NYXRjaF9NYXhCaXRzICYmXG4gICAgICAgICAgICAgIHRoaXMuZGlmZl9sZXZlbnNodGVpbihkaWZmcykgLyB0ZXh0MS5sZW5ndGggPlxuICAgICAgICAgICAgICB0aGlzLlBhdGNoX0RlbGV0ZVRocmVzaG9sZCkge1xuICAgICAgICAgICAgLy8gVGhlIGVuZCBwb2ludHMgbWF0Y2gsIGJ1dCB0aGUgY29udGVudCBpcyB1bmFjY2VwdGFibHkgYmFkLlxuICAgICAgICAgICAgcmVzdWx0c1t4XSA9IGZhbHNlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRpZmZfY2xlYW51cFNlbWFudGljTG9zc2xlc3MoZGlmZnMpO1xuICAgICAgICAgICAgbGV0IGluZGV4MSA9IDA7XG4gICAgICAgICAgICBsZXQgaW5kZXgyO1xuICAgICAgICAgICAgZm9yIChsZXQgeSA9IDA7IHkgPCBwYXRjaGVzW3hdLmRpZmZzLmxlbmd0aDsgeSsrKSB7XG4gICAgICAgICAgICAgIGNvbnN0IG1vZCA9IHBhdGNoZXNbeF0uZGlmZnNbeV07XG4gICAgICAgICAgICAgIGlmIChtb2RbMF0gIT09IERpZmZPcC5FcXVhbCkge1xuICAgICAgICAgICAgICAgIGluZGV4MiA9IHRoaXMuZGlmZl94SW5kZXgoZGlmZnMsIGluZGV4MSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKG1vZFswXSA9PT0gRGlmZk9wLkluc2VydCkgeyAgLy8gSW5zZXJ0aW9uXG4gICAgICAgICAgICAgICAgdGV4dCA9IHRleHQuc3Vic3RyaW5nKDAsIHN0YXJ0X2xvYyArIGluZGV4MikgKyBtb2RbMV0gK1xuICAgICAgICAgICAgICAgICAgICAgIHRleHQuc3Vic3RyaW5nKHN0YXJ0X2xvYyArIGluZGV4Mik7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kWzBdID09PSBEaWZmT3AuRGVsZXRlKSB7ICAvLyBEZWxldGlvblxuICAgICAgICAgICAgICAgIHRleHQgPSB0ZXh0LnN1YnN0cmluZygwLCBzdGFydF9sb2MgKyBpbmRleDIpICtcbiAgICAgICAgICAgICAgICAgICAgICB0ZXh0LnN1YnN0cmluZyhzdGFydF9sb2MgKyB0aGlzLmRpZmZfeEluZGV4KGRpZmZzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDEgKyBtb2RbMV0ubGVuZ3RoKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKG1vZFswXSAhPT0gRGlmZk9wLkRlbGV0ZSkge1xuICAgICAgICAgICAgICAgIGluZGV4MSArPSBtb2RbMV0ubGVuZ3RoO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFN0cmlwIHRoZSBwYWRkaW5nIG9mZi5cbiAgICB0ZXh0ID0gdGV4dC5zdWJzdHJpbmcobnVsbFBhZGRpbmcubGVuZ3RoLCB0ZXh0Lmxlbmd0aCAtIG51bGxQYWRkaW5nLmxlbmd0aCk7XG4gICAgcmV0dXJuIFt0ZXh0LCByZXN1bHRzXTtcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBBZGQgc29tZSBwYWRkaW5nIG9uIHRleHQgc3RhcnQgYW5kIGVuZCBzbyB0aGF0IGVkZ2VzIGNhbiBtYXRjaCBzb21ldGhpbmcuXG4gICAqIEludGVuZGVkIHRvIGJlIGNhbGxlZCBvbmx5IGZyb20gd2l0aGluIHBhdGNoX2FwcGx5LlxuICAgKiBAcGFyYW0gIHBhdGNoZXMgQXJyYXkgb2YgUGF0Y2ggb2JqZWN0cy5cbiAgICogQHJldHVybiAgVGhlIHBhZGRpbmcgc3RyaW5nIGFkZGVkIHRvIGVhY2ggc2lkZS5cbiAgICovXG4gICAgcGF0Y2hfYWRkUGFkZGluZyAocGF0Y2hlczogQXJyYXk8cGF0Y2hfb2JqPikge1xuICAgIGNvbnN0IHBhZGRpbmdMZW5ndGggPSB0aGlzLlBhdGNoX01hcmdpbjtcbiAgICBsZXQgbnVsbFBhZGRpbmcgPSAnJztcbiAgICBmb3IgKGxldCB4ID0gMTsgeCA8PSBwYWRkaW5nTGVuZ3RoOyB4KyspIHtcbiAgICAgIG51bGxQYWRkaW5nICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoeCk7XG4gICAgfVxuXG4gICAgLy8gQnVtcCBhbGwgdGhlIHBhdGNoZXMgZm9yd2FyZC5cbiAgICBmb3IgKGxldCB4ID0gMDsgeCA8IHBhdGNoZXMubGVuZ3RoOyB4KyspIHtcbiAgICAgIHBhdGNoZXNbeF0uc3RhcnQxICs9IHBhZGRpbmdMZW5ndGg7XG4gICAgICBwYXRjaGVzW3hdLnN0YXJ0MiArPSBwYWRkaW5nTGVuZ3RoO1xuICAgIH1cblxuICAgIC8vIEFkZCBzb21lIHBhZGRpbmcgb24gc3RhcnQgb2YgZmlyc3QgZGlmZi5cbiAgICBsZXQgcGF0Y2ggPSBwYXRjaGVzWzBdO1xuICAgIGxldCBkaWZmcyA9IHBhdGNoLmRpZmZzO1xuICAgIGlmIChkaWZmcy5sZW5ndGggPT0gMCB8fCBkaWZmc1swXVswXSAhPSBEaWZmT3AuRXF1YWwpIHtcbiAgICAgIC8vIEFkZCBudWxsUGFkZGluZyBlcXVhbGl0eS5cbiAgICAgIGRpZmZzLnVuc2hpZnQoW0RpZmZPcC5FcXVhbCwgbnVsbFBhZGRpbmddKTtcbiAgICAgIHBhdGNoLnN0YXJ0MSAtPSBwYWRkaW5nTGVuZ3RoOyAgLy8gU2hvdWxkIGJlIDAuXG4gICAgICBwYXRjaC5zdGFydDIgLT0gcGFkZGluZ0xlbmd0aDsgIC8vIFNob3VsZCBiZSAwLlxuICAgICAgcGF0Y2gubGVuZ3RoMSArPSBwYWRkaW5nTGVuZ3RoO1xuICAgICAgcGF0Y2gubGVuZ3RoMiArPSBwYWRkaW5nTGVuZ3RoO1xuICAgIH0gZWxzZSBpZiAocGFkZGluZ0xlbmd0aCA+IGRpZmZzWzBdWzFdLmxlbmd0aCkge1xuICAgICAgLy8gR3JvdyBmaXJzdCBlcXVhbGl0eS5cbiAgICAgIGNvbnN0IGV4dHJhTGVuZ3RoID0gcGFkZGluZ0xlbmd0aCAtIGRpZmZzWzBdWzFdLmxlbmd0aDtcbiAgICAgIGRpZmZzWzBdWzFdID0gbnVsbFBhZGRpbmcuc3Vic3RyaW5nKGRpZmZzWzBdWzFdLmxlbmd0aCkgKyBkaWZmc1swXVsxXTtcbiAgICAgIHBhdGNoLnN0YXJ0MSAtPSBleHRyYUxlbmd0aDtcbiAgICAgIHBhdGNoLnN0YXJ0MiAtPSBleHRyYUxlbmd0aDtcbiAgICAgIHBhdGNoLmxlbmd0aDEgKz0gZXh0cmFMZW5ndGg7XG4gICAgICBwYXRjaC5sZW5ndGgyICs9IGV4dHJhTGVuZ3RoO1xuICAgIH1cblxuICAgIC8vIEFkZCBzb21lIHBhZGRpbmcgb24gZW5kIG9mIGxhc3QgZGlmZi5cbiAgICBwYXRjaCA9IHBhdGNoZXNbcGF0Y2hlcy5sZW5ndGggLSAxXTtcbiAgICBkaWZmcyA9IHBhdGNoLmRpZmZzO1xuICAgIGlmIChkaWZmcy5sZW5ndGggPT0gMCB8fCBkaWZmc1tkaWZmcy5sZW5ndGggLSAxXVswXSAhPSBEaWZmT3AuRXF1YWwpIHtcbiAgICAgIC8vIEFkZCBudWxsUGFkZGluZyBlcXVhbGl0eS5cbiAgICAgIGRpZmZzLnB1c2goW0RpZmZPcC5FcXVhbCwgbnVsbFBhZGRpbmddKTtcbiAgICAgIHBhdGNoLmxlbmd0aDEgKz0gcGFkZGluZ0xlbmd0aDtcbiAgICAgIHBhdGNoLmxlbmd0aDIgKz0gcGFkZGluZ0xlbmd0aDtcbiAgICB9IGVsc2UgaWYgKHBhZGRpbmdMZW5ndGggPiBkaWZmc1tkaWZmcy5sZW5ndGggLSAxXVsxXS5sZW5ndGgpIHtcbiAgICAgIC8vIEdyb3cgbGFzdCBlcXVhbGl0eS5cbiAgICAgIGNvbnN0IGV4dHJhTGVuZ3RoID0gcGFkZGluZ0xlbmd0aCAtIGRpZmZzW2RpZmZzLmxlbmd0aCAtIDFdWzFdLmxlbmd0aDtcbiAgICAgIGRpZmZzW2RpZmZzLmxlbmd0aCAtIDFdWzFdICs9IG51bGxQYWRkaW5nLnN1YnN0cmluZygwLCBleHRyYUxlbmd0aCk7XG4gICAgICBwYXRjaC5sZW5ndGgxICs9IGV4dHJhTGVuZ3RoO1xuICAgICAgcGF0Y2gubGVuZ3RoMiArPSBleHRyYUxlbmd0aDtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbFBhZGRpbmc7XG4gIH07XG5cblxuICAvKipcbiAgICogTG9vayB0aHJvdWdoIHRoZSBwYXRjaGVzIGFuZCBicmVhayB1cCBhbnkgd2hpY2ggYXJlIGxvbmdlciB0aGFuIHRoZSBtYXhpbXVtXG4gICAqIGxpbWl0IG9mIHRoZSBtYXRjaCBhbGdvcml0aG0uXG4gICAqIEludGVuZGVkIHRvIGJlIGNhbGxlZCBvbmx5IGZyb20gd2l0aGluIHBhdGNoX2FwcGx5LlxuICAgKiBAcGFyYW0gIHBhdGNoZXMgQXJyYXkgb2YgUGF0Y2ggb2JqZWN0cy5cbiAgICovXG4gICAgcGF0Y2hfc3BsaXRNYXggPSBmdW5jdGlvbihwYXRjaGVzOiBBcnJheTxwYXRjaF9vYmo+KSB7XG4gICAgY29uc3QgcGF0Y2hfc2l6ZSA9IHRoaXMuTWF0Y2hfTWF4Qml0cztcbiAgICBmb3IgKGxldCB4ID0gMDsgeCA8IHBhdGNoZXMubGVuZ3RoOyB4KyspIHtcbiAgICAgIGlmIChwYXRjaGVzW3hdLmxlbmd0aDEgPD0gcGF0Y2hfc2l6ZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGJpZ3BhdGNoID0gcGF0Y2hlc1t4XTtcbiAgICAgIC8vIFJlbW92ZSB0aGUgYmlnIG9sZCBwYXRjaC5cbiAgICAgIHBhdGNoZXMuc3BsaWNlKHgtLSwgMSk7XG4gICAgICBsZXQgc3RhcnQxID0gYmlncGF0Y2guc3RhcnQxO1xuICAgICAgbGV0IHN0YXJ0MiA9IGJpZ3BhdGNoLnN0YXJ0MjtcbiAgICAgIGxldCBwcmVjb250ZXh0ID0gJyc7XG4gICAgICB3aGlsZSAoYmlncGF0Y2guZGlmZnMubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgIC8vIENyZWF0ZSBvbmUgb2Ygc2V2ZXJhbCBzbWFsbGVyIHBhdGNoZXMuXG4gICAgICAgIGNvbnN0IHBhdGNoID0gbmV3IHBhdGNoX29iaigpO1xuICAgICAgICBsZXQgZW1wdHkgPSB0cnVlO1xuICAgICAgICBwYXRjaC5zdGFydDEgPSBzdGFydDEgLSBwcmVjb250ZXh0Lmxlbmd0aDtcbiAgICAgICAgcGF0Y2guc3RhcnQyID0gc3RhcnQyIC0gcHJlY29udGV4dC5sZW5ndGg7XG4gICAgICAgIGlmIChwcmVjb250ZXh0ICE9PSAnJykge1xuICAgICAgICAgIHBhdGNoLmxlbmd0aDEgPSBwYXRjaC5sZW5ndGgyID0gcHJlY29udGV4dC5sZW5ndGg7XG4gICAgICAgICAgcGF0Y2guZGlmZnMucHVzaChbRGlmZk9wLkVxdWFsLCBwcmVjb250ZXh0XSk7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKGJpZ3BhdGNoLmRpZmZzLmxlbmd0aCAhPT0gMCAmJlxuICAgICAgICAgICAgICBwYXRjaC5sZW5ndGgxIDwgcGF0Y2hfc2l6ZSAtIHRoaXMuUGF0Y2hfTWFyZ2luKSB7XG4gICAgICAgICAgY29uc3QgZGlmZl90eXBlID0gYmlncGF0Y2guZGlmZnNbMF1bMF07XG4gICAgICAgICAgbGV0IGRpZmZfdGV4dCA9IGJpZ3BhdGNoLmRpZmZzWzBdWzFdO1xuICAgICAgICAgIGlmIChkaWZmX3R5cGUgPT09IERpZmZPcC5JbnNlcnQpIHtcbiAgICAgICAgICAgIC8vIEluc2VydGlvbnMgYXJlIGhhcm1sZXNzLlxuICAgICAgICAgICAgcGF0Y2gubGVuZ3RoMiArPSBkaWZmX3RleHQubGVuZ3RoO1xuICAgICAgICAgICAgc3RhcnQyICs9IGRpZmZfdGV4dC5sZW5ndGg7XG4gICAgICAgICAgICBwYXRjaC5kaWZmcy5wdXNoKGJpZ3BhdGNoLmRpZmZzLnNoaWZ0KCkpO1xuICAgICAgICAgICAgZW1wdHkgPSBmYWxzZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGRpZmZfdHlwZSA9PT0gRGlmZk9wLkRlbGV0ZSAmJiBwYXRjaC5kaWZmcy5sZW5ndGggPT0gMSAmJlxuICAgICAgICAgICAgICAgICAgICBwYXRjaC5kaWZmc1swXVswXSA9PSBEaWZmT3AuRXF1YWwgJiZcbiAgICAgICAgICAgICAgICAgICAgZGlmZl90ZXh0Lmxlbmd0aCA+IDIgKiBwYXRjaF9zaXplKSB7XG4gICAgICAgICAgICAvLyBUaGlzIGlzIGEgbGFyZ2UgZGVsZXRpb24uICBMZXQgaXQgcGFzcyBpbiBvbmUgY2h1bmsuXG4gICAgICAgICAgICBwYXRjaC5sZW5ndGgxICs9IGRpZmZfdGV4dC5sZW5ndGg7XG4gICAgICAgICAgICBzdGFydDEgKz0gZGlmZl90ZXh0Lmxlbmd0aDtcbiAgICAgICAgICAgIGVtcHR5ID0gZmFsc2U7XG4gICAgICAgICAgICBwYXRjaC5kaWZmcy5wdXNoKFtkaWZmX3R5cGUsIGRpZmZfdGV4dF0pO1xuICAgICAgICAgICAgYmlncGF0Y2guZGlmZnMuc2hpZnQoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gRGVsZXRpb24gb3IgZXF1YWxpdHkuICBPbmx5IHRha2UgYXMgbXVjaCBhcyB3ZSBjYW4gc3RvbWFjaC5cbiAgICAgICAgICAgIGRpZmZfdGV4dCA9IGRpZmZfdGV4dC5zdWJzdHJpbmcoMCxcbiAgICAgICAgICAgICAgICBwYXRjaF9zaXplIC0gcGF0Y2gubGVuZ3RoMSAtIHRoaXMuUGF0Y2hfTWFyZ2luKTtcbiAgICAgICAgICAgIHBhdGNoLmxlbmd0aDEgKz0gZGlmZl90ZXh0Lmxlbmd0aDtcbiAgICAgICAgICAgIHN0YXJ0MSArPSBkaWZmX3RleHQubGVuZ3RoO1xuICAgICAgICAgICAgaWYgKGRpZmZfdHlwZSA9PT0gRGlmZk9wLkVxdWFsKSB7XG4gICAgICAgICAgICAgIHBhdGNoLmxlbmd0aDIgKz0gZGlmZl90ZXh0Lmxlbmd0aDtcbiAgICAgICAgICAgICAgc3RhcnQyICs9IGRpZmZfdGV4dC5sZW5ndGg7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBlbXB0eSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGF0Y2guZGlmZnMucHVzaChbZGlmZl90eXBlLCBkaWZmX3RleHRdKTtcbiAgICAgICAgICAgIGlmIChkaWZmX3RleHQgPT0gYmlncGF0Y2guZGlmZnNbMF1bMV0pIHtcbiAgICAgICAgICAgICAgYmlncGF0Y2guZGlmZnMuc2hpZnQoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGJpZ3BhdGNoLmRpZmZzWzBdWzFdID1cbiAgICAgICAgICAgICAgICAgIGJpZ3BhdGNoLmRpZmZzWzBdWzFdLnN1YnN0cmluZyhkaWZmX3RleHQubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ29tcHV0ZSB0aGUgaGVhZCBjb250ZXh0IGZvciB0aGUgbmV4dCBwYXRjaC5cbiAgICAgICAgcHJlY29udGV4dCA9IHRoaXMuZGlmZl90ZXh0MihwYXRjaC5kaWZmcyk7XG4gICAgICAgIHByZWNvbnRleHQgPVxuICAgICAgICAgICAgcHJlY29udGV4dC5zdWJzdHJpbmcocHJlY29udGV4dC5sZW5ndGggLSB0aGlzLlBhdGNoX01hcmdpbik7XG4gICAgICAgIC8vIEFwcGVuZCB0aGUgZW5kIGNvbnRleHQgZm9yIHRoaXMgcGF0Y2guXG4gICAgICAgIGNvbnN0IHBvc3Rjb250ZXh0ID0gdGhpcy5kaWZmX3RleHQxKGJpZ3BhdGNoLmRpZmZzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnN1YnN0cmluZygwLCB0aGlzLlBhdGNoX01hcmdpbik7XG4gICAgICAgIGlmIChwb3N0Y29udGV4dCAhPT0gJycpIHtcbiAgICAgICAgICBwYXRjaC5sZW5ndGgxICs9IHBvc3Rjb250ZXh0Lmxlbmd0aDtcbiAgICAgICAgICBwYXRjaC5sZW5ndGgyICs9IHBvc3Rjb250ZXh0Lmxlbmd0aDtcbiAgICAgICAgICBpZiAocGF0Y2guZGlmZnMubGVuZ3RoICE9PSAwICYmXG4gICAgICAgICAgICAgIHBhdGNoLmRpZmZzW3BhdGNoLmRpZmZzLmxlbmd0aCAtIDFdWzBdID09PSBEaWZmT3AuRXF1YWwpIHtcbiAgICAgICAgICAgIHBhdGNoLmRpZmZzW3BhdGNoLmRpZmZzLmxlbmd0aCAtIDFdWzFdICs9IHBvc3Rjb250ZXh0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwYXRjaC5kaWZmcy5wdXNoKFtEaWZmT3AuRXF1YWwsIHBvc3Rjb250ZXh0XSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghZW1wdHkpIHtcbiAgICAgICAgICBwYXRjaGVzLnNwbGljZSgrK3gsIDAsIHBhdGNoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfTtcblxuXG4gIC8qKlxuICAgKiBUYWtlIGEgbGlzdCBvZiBwYXRjaGVzIGFuZCByZXR1cm4gYSB0ZXh0dWFsIHJlcHJlc2VudGF0aW9uLlxuICAgKiBAcGFyYW0gIHBhdGNoZXMgQXJyYXkgb2YgUGF0Y2ggb2JqZWN0cy5cbiAgICogQHJldHVybiAgVGV4dCByZXByZXNlbnRhdGlvbiBvZiBwYXRjaGVzLlxuICAgKi9cbiAgICBwYXRjaF90b1RleHQgKHBhdGNoZXM6IEFycmF5PHBhdGNoX29iaj4pIHtcbiAgICBjb25zdCB0ZXh0ID0gW107XG4gICAgZm9yIChsZXQgeCA9IDA7IHggPCBwYXRjaGVzLmxlbmd0aDsgeCsrKSB7XG4gICAgICB0ZXh0W3hdID0gcGF0Y2hlc1t4XTtcbiAgICB9XG4gICAgcmV0dXJuIHRleHQuam9pbignJyk7XG4gIH07XG5cblxuICAvKipcbiAgICogUGFyc2UgYSB0ZXh0dWFsIHJlcHJlc2VudGF0aW9uIG9mIHBhdGNoZXMgYW5kIHJldHVybiBhIGxpc3Qgb2YgUGF0Y2ggb2JqZWN0cy5cbiAgICogQHBhcmFtICB0ZXh0bGluZSBUZXh0IHJlcHJlc2VudGF0aW9uIG9mIHBhdGNoZXMuXG4gICAqIEByZXR1cm4gIEFycmF5IG9mIFBhdGNoIG9iamVjdHMuXG4gICAqIEB0aHJvd3MgeyFFcnJvcn0gSWYgaW52YWxpZCBpbnB1dC5cbiAgICovXG4gICAgcGF0Y2hfZnJvbVRleHQgKHRleHRsaW5lOiBzdHJpbmcpOiBBcnJheTxwYXRjaF9vYmo+IHtcbiAgICBjb25zdCBwYXRjaGVzOiBBcnJheTxwYXRjaF9vYmo+ID0gW107XG4gICAgaWYgKCF0ZXh0bGluZSkge1xuICAgICAgcmV0dXJuIHBhdGNoZXM7XG4gICAgfVxuICAgIGNvbnN0IHRleHQgPSB0ZXh0bGluZS5zcGxpdCgnXFxuJyk7XG4gICAgbGV0IHRleHRQb2ludGVyID0gMDtcbiAgICBjb25zdCBwYXRjaEhlYWRlciA9IC9eQEAgLShcXGQrKSw/KFxcZCopIFxcKyhcXGQrKSw/KFxcZCopIEBAJC87XG4gICAgd2hpbGUgKHRleHRQb2ludGVyIDwgdGV4dC5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IG0gPSB0ZXh0W3RleHRQb2ludGVyXS5tYXRjaChwYXRjaEhlYWRlcik7XG4gICAgICBpZiAoIW0pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHBhdGNoIHN0cmluZzogJyArIHRleHRbdGV4dFBvaW50ZXJdKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHBhdGNoID0gbmV3IHBhdGNoX29iaigpO1xuICAgICAgcGF0Y2hlcy5wdXNoKHBhdGNoKTtcbiAgICAgIHBhdGNoLnN0YXJ0MSA9IHBhcnNlSW50KG1bMV0sIDEwKTtcbiAgICAgIGlmIChtWzJdID09PSAnJykge1xuICAgICAgICBwYXRjaC5zdGFydDEtLTtcbiAgICAgICAgcGF0Y2gubGVuZ3RoMSA9IDE7XG4gICAgICB9IGVsc2UgaWYgKG1bMl0gPT0gJzAnKSB7XG4gICAgICAgIHBhdGNoLmxlbmd0aDEgPSAwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGF0Y2guc3RhcnQxLS07XG4gICAgICAgIHBhdGNoLmxlbmd0aDEgPSBwYXJzZUludChtWzJdLCAxMCk7XG4gICAgICB9XG5cbiAgICAgIHBhdGNoLnN0YXJ0MiA9IHBhcnNlSW50KG1bM10sIDEwKTtcbiAgICAgIGlmIChtWzRdID09PSAnJykge1xuICAgICAgICBwYXRjaC5zdGFydDItLTtcbiAgICAgICAgcGF0Y2gubGVuZ3RoMiA9IDE7XG4gICAgICB9IGVsc2UgaWYgKG1bNF0gPT0gJzAnKSB7XG4gICAgICAgIHBhdGNoLmxlbmd0aDIgPSAwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGF0Y2guc3RhcnQyLS07XG4gICAgICAgIHBhdGNoLmxlbmd0aDIgPSBwYXJzZUludChtWzRdLCAxMCk7XG4gICAgICB9XG4gICAgICB0ZXh0UG9pbnRlcisrO1xuXG4gICAgICB3aGlsZSAodGV4dFBvaW50ZXIgPCB0ZXh0Lmxlbmd0aCkge1xuICAgICAgICBjb25zdCBzaWduID0gdGV4dFt0ZXh0UG9pbnRlcl0uY2hhckF0KDApO1xuICAgICAgICBsZXQgbGluZTogc3RyaW5nO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGxpbmUgPSBkZWNvZGVVUkkodGV4dFt0ZXh0UG9pbnRlcl0uc3Vic3RyaW5nKDEpKTtcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAvLyBNYWxmb3JtZWQgVVJJIHNlcXVlbmNlLlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBlc2NhcGUgaW4gcGF0Y2hfZnJvbVRleHQ6ICcgKyBsaW5lKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2lnbiA9PSAnLScpIHtcbiAgICAgICAgICAvLyBEZWxldGlvbi5cbiAgICAgICAgICBwYXRjaC5kaWZmcy5wdXNoKFtEaWZmT3AuRGVsZXRlLCBsaW5lXSk7XG4gICAgICAgIH0gZWxzZSBpZiAoc2lnbiA9PSAnKycpIHtcbiAgICAgICAgICAvLyBJbnNlcnRpb24uXG4gICAgICAgICAgcGF0Y2guZGlmZnMucHVzaChbRGlmZk9wLkluc2VydCwgbGluZV0pO1xuICAgICAgICB9IGVsc2UgaWYgKHNpZ24gPT0gJyAnKSB7XG4gICAgICAgICAgLy8gTWlub3IgZXF1YWxpdHkuXG4gICAgICAgICAgcGF0Y2guZGlmZnMucHVzaChbRGlmZk9wLkVxdWFsLCBsaW5lXSk7XG4gICAgICAgIH0gZWxzZSBpZiAoc2lnbiA9PSAnQCcpIHtcbiAgICAgICAgICAvLyBTdGFydCBvZiBuZXh0IHBhdGNoLlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGVsc2UgaWYgKHNpZ24gPT09ICcnKSB7XG4gICAgICAgICAgLy8gQmxhbmsgbGluZT8gIFdoYXRldmVyLlxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFdURj9cbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcGF0Y2ggbW9kZSBcIicgKyBzaWduICsgJ1wiIGluOiAnICsgbGluZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGV4dFBvaW50ZXIrKztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHBhdGNoZXM7XG4gIH07XG5cbn1cblxuXG4vKipcbiAqIENsYXNzIHJlcHJlc2VudGluZyBvbmUgcGF0Y2ggb3BlcmF0aW9uLlxuXG4gKi9cbmV4cG9ydCBjbGFzcyBwYXRjaF9vYmoge1xuXG4gIGNvbnN0cnVjdG9yKCkgeyAgfVxuXG4gIGRpZmZzOiBBcnJheTxEaWZmPiA9IFtdO1xuICBzdGFydDE6IG51bWJlciA9IG51bGw7XG4gIHN0YXJ0MjogbnVtYmVyID0gbnVsbDtcbiAgbGVuZ3RoMTogbnVtYmVyID0gMDtcbiAgbGVuZ3RoMjogbnVtYmVyID0gMDtcblxuICAvKipcbiAgICogRW1tdWxhdGUgR05VIGRpZmYncyBmb3JtYXQuXG4gICAqIEhlYWRlcjogQEAgLTM4Miw4ICs0ODEsOSBAQFxuICAgKiBJbmRpY2llcyBhcmUgcHJpbnRlZCBhcyAxLWJhc2VkLCBub3QgMC1iYXNlZC5cbiAgICovXG4gIHRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgbGV0IGNvb3JkczEsIGNvb3JkczI7XG4gICAgaWYgKHRoaXMubGVuZ3RoMSA9PT0gMCkge1xuICAgICAgY29vcmRzMSA9IHRoaXMuc3RhcnQxICsgJywwJztcbiAgICB9IGVsc2UgaWYgKHRoaXMubGVuZ3RoMSA9PSAxKSB7XG4gICAgICBjb29yZHMxID0gdGhpcy5zdGFydDEgKyAxO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb29yZHMxID0gKHRoaXMuc3RhcnQxICsgMSkgKyAnLCcgKyB0aGlzLmxlbmd0aDE7XG4gICAgfVxuICAgIGlmICh0aGlzLmxlbmd0aDIgPT09IDApIHtcbiAgICAgIGNvb3JkczIgPSB0aGlzLnN0YXJ0MiArICcsMCc7XG4gICAgfSBlbHNlIGlmICh0aGlzLmxlbmd0aDIgPT0gMSkge1xuICAgICAgY29vcmRzMiA9IHRoaXMuc3RhcnQyICsgMTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29vcmRzMiA9ICh0aGlzLnN0YXJ0MiArIDEpICsgJywnICsgdGhpcy5sZW5ndGgyO1xuICAgIH1cbiAgICBjb25zdCB0ZXh0ID0gWydAQCAtJyArIGNvb3JkczEgKyAnICsnICsgY29vcmRzMiArICcgQEBcXG4nXTtcbiAgICBsZXQgb3A7XG4gICAgLy8gRXNjYXBlIHRoZSBib2R5IG9mIHRoZSBwYXRjaCB3aXRoICV4eCBub3RhdGlvbi5cbiAgICBmb3IgKGxldCB4ID0gMDsgeCA8IHRoaXMuZGlmZnMubGVuZ3RoOyB4KyspIHtcbiAgICAgIHN3aXRjaCAodGhpcy5kaWZmc1t4XVswXSkge1xuICAgICAgICBjYXNlIERpZmZPcC5JbnNlcnQ6XG4gICAgICAgICAgb3AgPSAnKyc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRGlmZk9wLkRlbGV0ZTpcbiAgICAgICAgICBvcCA9ICctJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBEaWZmT3AuRXF1YWw6XG4gICAgICAgICAgb3AgPSAnICc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB0ZXh0W3ggKyAxXSA9IG9wICsgZW5jb2RlVVJJKHRoaXMuZGlmZnNbeF1bMV0pICsgJ1xcbic7XG4gICAgfVxuICAgIHJldHVybiB0ZXh0LmpvaW4oJycpLnJlcGxhY2UoLyUyMC9nLCAnICcpO1xuICB9XG59XG5cbmV4cG9ydCB7IERpZmZNYXRjaFBhdGNoIH07XG4iXX0=