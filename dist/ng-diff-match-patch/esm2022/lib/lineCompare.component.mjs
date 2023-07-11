import { Component, Input } from '@angular/core';
import * as i0 from "@angular/core";
import * as i1 from "./diffMatchPatch.service";
import * as i2 from "@angular/common";
class LineCompareComponent {
    constructor(dmp) {
        this.dmp = dmp;
        this.left = '';
        this.right = '';
    }
    ngOnInit() {
        this.updateHtml();
    }
    ngOnChanges() {
        this.updateHtml();
    }
    updateHtml() {
        if (typeof this.left === 'number' || typeof this.left === 'boolean') {
            this.left = this.left.toString();
        }
        if (typeof this.right === 'number' || typeof this.right === 'boolean') {
            this.right = this.right.toString();
        }
        this.calculateLineDiff(this.dmp.getLineDiff(this.left, this.right));
    }
    calculateLineDiff(diffs) {
        const diffCalculation = {
            lines: [],
            lineLeft: 1,
            lineRight: 1
        };
        this.isContentEqual = diffs.length === 1 && diffs[0][0] === 0 /* DiffOp.Equal */;
        if (this.isContentEqual) {
            this.calculatedDiff = [];
            return;
        }
        for (let i = 0; i < diffs.length; i++) {
            const diff = diffs[i];
            let diffLines = diff[1].split(/\r?\n/);
            // If the original line had a \r\n at the end then remove the
            // empty string after it.
            if (diffLines[diffLines.length - 1].length == 0) {
                diffLines.pop();
            }
            switch (diff[0]) {
                case 0 /* DiffOp.Equal */: {
                    const isFirstDiff = i === 0;
                    const isLastDiff = i === diffs.length - 1;
                    this.outputEqualDiff(diffLines, diffCalculation, isFirstDiff, isLastDiff);
                    break;
                }
                case -1 /* DiffOp.Delete */: {
                    this.outputDeleteDiff(diffLines, diffCalculation);
                    break;
                }
                case 1 /* DiffOp.Insert */: {
                    this.outputInsertDiff(diffLines, diffCalculation);
                    break;
                }
            }
        }
        this.calculatedDiff = diffCalculation.lines;
    }
    /* If the number of diffLines is greater than lineContextSize then we may need to adjust the diff
     * that is output.
     *   > If the first diff of a document is DiffOp.Equal then the leading lines can be dropped
     *     leaving the last 'lineContextSize' lines for context.
     *   > If the last diff of a document is DiffOp.Equal then the trailing lines can be dropped
     *     leaving the first 'lineContextSize' lines for context.
     *   > If the diff is a DiffOp.Equal occurs in the middle then the diffs either side of it must be
     *     DiffOp.Insert or DiffOp.Delete. If it has more than 2 * 'lineContextSize' lines of content
     *     then the middle lines are dropped leaving the first 'lineContextSize' and last 'lineContextSize'
     *     lines for context. A special line is inserted with '...' indicating that content is skipped.
     *
     * A document cannot consist of a single Diff with DiffOp.Equal and reach this function because
     * in this case the calculateLineDiff method returns early.
     */
    outputEqualDiff(diffLines, diffCalculation, isFirstDiff, isLastDiff) {
        if (this.lineContextSize && diffLines.length > this.lineContextSize) {
            if (isFirstDiff) {
                // Take the last 'lineContextSize' lines from the first diff
                const lineIncrement = diffLines.length - this.lineContextSize;
                diffCalculation.lineLeft += lineIncrement;
                diffCalculation.lineRight += lineIncrement;
                diffLines = diffLines.slice(diffLines.length - this.lineContextSize, diffLines.length);
            }
            else if (isLastDiff) {
                // Take only the first 'lineContextSize' lines from the final diff
                diffLines = diffLines.slice(0, this.lineContextSize);
            }
            else if (diffLines.length > 2 * this.lineContextSize) {
                // Take the first 'lineContextSize' lines from this diff to provide context for the last diff
                this.outputEqualDiffLines(diffLines.slice(0, this.lineContextSize), diffCalculation);
                // Output a special line indicating that some content is equal and has been skipped
                diffCalculation.lines.push(['dmp-line-compare-equal', '...', '...', '...']);
                const numberOfSkippedLines = diffLines.length - (2 * this.lineContextSize);
                diffCalculation.lineLeft += numberOfSkippedLines;
                diffCalculation.lineRight += numberOfSkippedLines;
                // Take the last 'lineContextSize' lines from this diff to provide context for the next diff
                this.outputEqualDiffLines(diffLines.slice(diffLines.length - this.lineContextSize), diffCalculation);
                // This if branch has already output the diff lines so we return early to avoid outputting the lines
                // at the end of the method.
                return;
            }
        }
        this.outputEqualDiffLines(diffLines, diffCalculation);
    }
    outputEqualDiffLines(diffLines, diffCalculation) {
        for (const line of diffLines) {
            diffCalculation.lines.push(['dmp-line-compare-equal', `${diffCalculation.lineLeft}`, `${diffCalculation.lineRight}`, line]);
            diffCalculation.lineLeft++;
            diffCalculation.lineRight++;
        }
    }
    outputDeleteDiff(diffLines, diffCalculation) {
        for (const line of diffLines) {
            diffCalculation.lines.push(['dmp-line-compare-delete', `${diffCalculation.lineLeft}`, '-', line]);
            diffCalculation.lineLeft++;
        }
    }
    outputInsertDiff(diffLines, diffCalculation) {
        for (const line of diffLines) {
            diffCalculation.lines.push(['dmp-line-compare-insert', '-', `${diffCalculation.lineRight}`, line]);
            diffCalculation.lineRight++;
        }
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: LineCompareComponent, deps: [{ token: i1.DiffMatchPatchService }], target: i0.ɵɵFactoryTarget.Component }); }
    static { this.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "16.1.4", type: LineCompareComponent, selector: "dmp-line-compare", inputs: { left: "left", right: "right", lineContextSize: "lineContextSize" }, usesOnChanges: true, ngImport: i0, template: `
    <div class="dmp-line-compare-no-changes-text" *ngIf="isContentEqual">
      There are no changes to display.
    </div>    
    <div class="dmp-line-compare" *ngIf="!isContentEqual">
      <div class="dmp-line-compare-margin">
        <div [ngClass]="lineDiff[0]" *ngFor="let lineDiff of calculatedDiff">
          <div class="dmp-line-compare-left">{{lineDiff[1]}}</div><!-- No space
        --><div class="dmp-line-compare-right">{{lineDiff[2]}}</div>
        </div>
        <div class="dmp-margin-bottom-spacer"></div>
      </div><!-- No space
   --><div class="dmp-line-compare-content">
        <div class="dmp-line-compare-content-wrapper">
          <div [ngClass]="lineDiff[0]" *ngFor="let lineDiff of calculatedDiff">
            <div class="dmp-line-compare-text">{{lineDiff[3]}}</div>
          </div>
        </div>
      </div>
    </div>
  `, isInline: true, styles: ["div.dmp-line-compare{display:flex;flex-direction:row;border:1px solid #808080;font-family:Consolas,Courier,monospace;width:911px}div.dmp-line-compare-margin{width:101px}div.dmp-line-compare-content{position:relative;top:0;left:0;flex-grow:1;overflow-x:scroll}div.dmp-line-compare-content-wrapper{position:absolute;top:0;left:0;display:flex;flex-direction:column;align-items:stretch}div.dmp-line-compare-left{width:50px;text-align:center;color:#484848}div.dmp-line-compare-equal>div.dmp-line-compare-left,div.dmp-line-compare-equal>div.dmp-line-compare-right{background-color:#dedede}div.dmp-line-compare-insert>div.dmp-line-compare-left,div.dmp-line-compare-insert>div.dmp-line-compare-right{background-color:#8bfb6f}div.dmp-line-compare-delete>div.dmp-line-compare-left,div.dmp-line-compare-delete>div.dmp-line-compare-right{background-color:#f56868}div.dmp-line-compare-right{width:50px;text-align:center;color:#484848;border-right:1px solid #888888}div.dmp-line-compare-text{white-space:pre;padding-left:10px;min-width:800px}.dmp-line-compare-delete{background-color:#ff8c8c}.dmp-line-compare-insert{background-color:#9dff97}.dmp-line-compare-delete>div{display:inline-block}.dmp-line-compare-insert>div{display:inline-block}.dmp-line-compare-equal>div{display:inline-block}.dmp-margin-bottom-spacer{height:20px;background-color:#dedede;border-right:1px solid #888888}\n"], dependencies: [{ kind: "directive", type: i2.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }] }); }
}
export { LineCompareComponent };
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: LineCompareComponent, decorators: [{
            type: Component,
            args: [{ selector: 'dmp-line-compare', template: `
    <div class="dmp-line-compare-no-changes-text" *ngIf="isContentEqual">
      There are no changes to display.
    </div>    
    <div class="dmp-line-compare" *ngIf="!isContentEqual">
      <div class="dmp-line-compare-margin">
        <div [ngClass]="lineDiff[0]" *ngFor="let lineDiff of calculatedDiff">
          <div class="dmp-line-compare-left">{{lineDiff[1]}}</div><!-- No space
        --><div class="dmp-line-compare-right">{{lineDiff[2]}}</div>
        </div>
        <div class="dmp-margin-bottom-spacer"></div>
      </div><!-- No space
   --><div class="dmp-line-compare-content">
        <div class="dmp-line-compare-content-wrapper">
          <div [ngClass]="lineDiff[0]" *ngFor="let lineDiff of calculatedDiff">
            <div class="dmp-line-compare-text">{{lineDiff[3]}}</div>
          </div>
        </div>
      </div>
    </div>
  `, styles: ["div.dmp-line-compare{display:flex;flex-direction:row;border:1px solid #808080;font-family:Consolas,Courier,monospace;width:911px}div.dmp-line-compare-margin{width:101px}div.dmp-line-compare-content{position:relative;top:0;left:0;flex-grow:1;overflow-x:scroll}div.dmp-line-compare-content-wrapper{position:absolute;top:0;left:0;display:flex;flex-direction:column;align-items:stretch}div.dmp-line-compare-left{width:50px;text-align:center;color:#484848}div.dmp-line-compare-equal>div.dmp-line-compare-left,div.dmp-line-compare-equal>div.dmp-line-compare-right{background-color:#dedede}div.dmp-line-compare-insert>div.dmp-line-compare-left,div.dmp-line-compare-insert>div.dmp-line-compare-right{background-color:#8bfb6f}div.dmp-line-compare-delete>div.dmp-line-compare-left,div.dmp-line-compare-delete>div.dmp-line-compare-right{background-color:#f56868}div.dmp-line-compare-right{width:50px;text-align:center;color:#484848;border-right:1px solid #888888}div.dmp-line-compare-text{white-space:pre;padding-left:10px;min-width:800px}.dmp-line-compare-delete{background-color:#ff8c8c}.dmp-line-compare-insert{background-color:#9dff97}.dmp-line-compare-delete>div{display:inline-block}.dmp-line-compare-insert>div{display:inline-block}.dmp-line-compare-equal>div{display:inline-block}.dmp-margin-bottom-spacer{height:20px;background-color:#dedede;border-right:1px solid #888888}\n"] }]
        }], ctorParameters: function () { return [{ type: i1.DiffMatchPatchService }]; }, propDecorators: { left: [{
                type: Input
            }], right: [{
                type: Input
            }], lineContextSize: [{
                type: Input
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluZUNvbXBhcmUuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vcHJvamVjdHMvbmctZGlmZi1tYXRjaC1wYXRjaC9zcmMvbGliL2xpbmVDb21wYXJlLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBcUIsTUFBTSxlQUFlLENBQUM7Ozs7QUFlcEUsTUFtR2Esb0JBQW9CO0lBYS9CLFlBQ1ksR0FBMEI7UUFBMUIsUUFBRyxHQUFILEdBQUcsQ0FBdUI7UUFaL0IsU0FBSSxHQUE4QixFQUFFLENBQUM7UUFFckMsVUFBSyxHQUE4QixFQUFFLENBQUM7SUFVSixDQUFDO0lBRW5DLFFBQVE7UUFDYixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDcEIsQ0FBQztJQUVNLFdBQVc7UUFDaEIsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3BCLENBQUM7SUFFTyxVQUFVO1FBQ2hCLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO1lBQ25FLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUNsQztRQUNELElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxLQUFLLFFBQVEsSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFFO1lBQ3JFLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUNwQztRQUNELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFFTyxpQkFBaUIsQ0FBQyxL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RUFBRTtZQUM1QixlQUFlLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLHlCQUF5QixFQUFFLEdBQUcsZUFBZSxDQUFDLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ2xHLGVBQWUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUM1QjtJQUNILENBQUM7SUFFTyxnQkFBZ0IsQ0FDcEIsU0FBbUIsRUFDbkIsZUFBZ0M7UUFDbEMsS0FBSyxNQUFNLElBQUksSUFBSSxTQUFTLEVBQUU7WUFDNUIsZUFBZSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyx5QkFBeUIsRUFBRSxHQUFHLEVBQUUsR0FBRyxlQUFlLENBQUMsU0FBUyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNuRyxlQUFlLENBQUMsU0FBUyxFQUFFLENBQUM7U0FDN0I7SUFDSCxDQUFDOzhHQTNKVSxvQkFBb0I7a0dBQXBCLG9CQUFvQiwySkF0QnJCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW9CVDs7U0FFVSxvQkFBb0I7MkZBQXBCLG9CQUFvQjtrQkFuR2hDLFNBQVM7K0JBQ0Usa0JBQWtCLFlBNEVsQjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FvQlQ7NEdBSU0sSUFBSTtzQkFEVixLQUFLO2dCQUdDLEtBQUs7c0JBRFgsS0FBSztnQkFLQyxlQUFlO3NCQURyQixLQUFLIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBJbnB1dCwgT25Jbml0LCBPbkNoYW5nZXMgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IERpZmYsIERpZmZPcCB9IGZyb20gJy4vZGlmZk1hdGNoUGF0Y2gnO1xuaW1wb3J0IHsgRGlmZk1hdGNoUGF0Y2hTZXJ2aWNlIH0gZnJvbSAnLi9kaWZmTWF0Y2hQYXRjaC5zZXJ2aWNlJztcblxuLyogSG9sZHMgdGhlIHN0YXRlIG9mIHRoZSBjYWxjdWxhdGlvbiBvZiB0aGUgZGlmZiByZXN1bHQgd2UgaW50ZW5kIHRvIGRpc3BsYXkuXG4gKiAgPiBsaW5lcyBjb250YWlucyB0aGUgZGF0YSB0aGF0IHdpbGwgYmUgZGlzcGxheWVkIG9uIHNjcmVlbi5cbiAqICA+IGxpbmVMZWZ0IGtlZXBzIHRyYWNrIG9mIHRoZSBkb2N1bWVudCBsaW5lIG51bWJlciBpbiB0aGUgW2xlZnRdIGlucHV0LlxuICogID4gbGluZVJpZ2h0IGtlZXBzIHRyYWNrIG9mIHRoZSBkb2N1bWVudCBsaW5lIG51bWJlciBpbiB0aGUgW3JpZ2h0XSBpbnB1dC5cbiAqL1xudHlwZSBEaWZmQ2FsY3VsYXRpb24gPSB7XG4gIGxpbmVzOiBBcnJheTxbc3RyaW5nLCBzdHJpbmcsIHN0cmluZywgc3RyaW5nXT4sXG4gIGxpbmVMZWZ0OiBudW1iZXIsXG4gIGxpbmVSaWdodDogbnVtYmVyXG59O1xuXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICdkbXAtbGluZS1jb21wYXJlJyxcbiAgc3R5bGVzOiBbYFxuICAgIGRpdi5kbXAtbGluZS1jb21wYXJlIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogcm93O1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgIzgwODA4MDtcbiAgICAgIGZvbnQtZmFtaWx5OiBDb25zb2xhcywgQ291cmllciwgbW9ub3NwYWNlO1xuICAgICAgd2lkdGg6IDkxMXB4O1xuICAgIH1cbiAgICBkaXYuZG1wLWxpbmUtY29tcGFyZS1tYXJnaW4ge1xuICAgICAgd2lkdGg6IDEwMXB4O1xuICAgIH1cbiAgICBkaXYuZG1wLWxpbmUtY29tcGFyZS1jb250ZW50IHtcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgIHRvcDogMHB4O1xuICAgICAgbGVmdDogMHB4O1xuICAgICAgZmxleC1ncm93OiAxO1xuICAgICAgb3ZlcmZsb3cteDogc2Nyb2xsO1xuICAgIH1cbiAgICBkaXYuZG1wLWxpbmUtY29tcGFyZS1jb250ZW50LXdyYXBwZXIge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAwcHg7XG4gICAgICBsZWZ0OiAwcHg7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBzdHJldGNoO1xuICAgIH1cbiAgICBkaXYuZG1wLWxpbmUtY29tcGFyZS1sZWZ0IHtcbiAgICAgIHdpZHRoOiA1MHB4O1xuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgY29sb3I6ICM0ODQ4NDg7XG4gICAgfVxuICAgIGRpdi5kbXAtbGluZS1jb21wYXJlLWVxdWFsPmRpdi5kbXAtbGluZS1jb21wYXJlLWxlZnQsXG4gICAgICBkaXYuZG1wLWxpbmUtY29tcGFyZS1lcXVhbD5kaXYuZG1wLWxpbmUtY29tcGFyZS1yaWdodCB7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjZGVkZWRlO1xuICAgIH1cbiAgICBkaXYuZG1wLWxpbmUtY29tcGFyZS1pbnNlcnQ+ZGl2LmRtcC1saW5lLWNvbXBhcmUtbGVmdCxcbiAgICAgIGRpdi5kbXAtbGluZS1jb21wYXJlLWluc2VydD5kaXYuZG1wLWxpbmUtY29tcGFyZS1yaWdodCB7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjOGJmYjZmO1xuICAgIH1cbiAgICBkaXYuZG1wLWxpbmUtY29tcGFyZS1kZWxldGU+ZGl2LmRtcC1saW5lLWNvbXBhcmUtbGVmdCxcbiAgICAgIGRpdi5kbXAtbGluZS1jb21wYXJlLWRlbGV0ZT5kaXYuZG1wLWxpbmUtY29tcGFyZS1yaWdodCB7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjZjU2ODY4O1xuICAgIH1cbiAgICBkaXYuZG1wLWxpbmUtY29tcGFyZS1yaWdodCB7XG4gICAgICB3aWR0aDogNTBweDtcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICAgIGNvbG9yOiAjNDg0ODQ4O1xuICAgICAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgIzg4ODg4ODtcbiAgICB9XG4gICAgZGl2LmRtcC1saW5lLWNvbXBhcmUtdGV4dCB7XG4gICAgICB3aGl0ZS1zcGFjZTogcHJlO1xuICAgICAgcGFkZGluZy1sZWZ0OiAxMHB4O1xuICAgICAgbWluLXdpZHRoOiA4MDBweDtcbiAgICB9XG4gICAgLmRtcC1saW5lLWNvbXBhcmUtZGVsZXRlIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICNmZjhjOGM7XG4gICAgfVxuICAgIC5kbXAtbGluZS1jb21wYXJlLWluc2VydCB7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjOWRmZjk3O1xuICAgIH1cbiAgICAuZG1wLWxpbmUtY29tcGFyZS1kZWxldGU+ZGl2IHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICB9ICBcbiAgICAuZG1wLWxpbmUtY29tcGFyZS1pbnNlcnQ+ZGl2IHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICB9XG4gICAgLmRtcC1saW5lLWNvbXBhcmUtZXF1YWw+ZGl2IHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICB9XG4gICAgLmRtcC1tYXJnaW4tYm90dG9tLXNwYWNlciB7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjZGVkZWRlO1xuICAgICAgYm9yZGVyLXJpZ2h0OiAxcHggc29saWQgIzg4ODg4ODtcbiAgICB9XG4gIGBdLFxuICB0ZW1wbGF0ZTogYFxuICAgIDxkaXYgY2xhc3M9XCJkbXAtbGluZS1jb21wYXJlLW5vLWNoYW5nZXMtdGV4dFwiICpuZ0lmPVwiaXNDb250ZW50RXF1YWxcIj5cbiAgICAgIFRoZXJlIGFyZSBubyBjaGFuZ2VzIHRvIGRpc3BsYXkuXG4gICAgPC9kaXY+ICAgIFxuICAgIDxkaXYgY2xhc3M9XCJkbXAtbGluZS1jb21wYXJlXCIgKm5nSWY9XCIhaXNDb250ZW50RXF1YWxcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkbXAtbGluZS1jb21wYXJlLW1hcmdpblwiPlxuICAgICAgICA8ZGl2IFtuZ0NsYXNzXT1cImxpbmVEaWZmWzBdXCIgKm5nRm9yPVwibGV0IGxpbmVEaWZmIG9mIGNhbGN1bGF0ZWREaWZmXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImRtcC1saW5lLWNvbXBhcmUtbGVmdFwiPnt7bGluZURpZmZbMV19fTwvZGl2PjwhLS0gTm8gc3BhY2VcbiAgICAgICAgLS0+PGRpdiBjbGFzcz1cImRtcC1saW5lLWNvbXBhcmUtcmlnaHRcIj57e2xpbmVEaWZmWzJdfX08L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJkbXAtbWFyZ2luLWJvdHRvbS1zcGFjZXJcIj48L2Rpdj5cbiAgICAgIDwvZGl2PjwhLS0gTm8gc3BhY2VcbiAgIC0tPjxkaXYgY2xhc3M9XCJkbXAtbGluZS1jb21wYXJlLWNvbnRlbnRcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImRtcC1saW5lLWNvbXBhcmUtY29udGVudC13cmFwcGVyXCI+XG4gICAgICAgICAgPGRpdiBbbmdDbGFzc109XCJsaW5lRGlmZlswXVwiICpuZ0Zvcj1cImxldCBsaW5lRGlmZiBvZiBjYWxjdWxhdGVkRGlmZlwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImRtcC1saW5lLWNvbXBhcmUtdGV4dFwiPnt7bGluZURpZmZbM119fTwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICBgXG59KVxuZXhwb3J0IGNsYXNzIExpbmVDb21wYXJlQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkNoYW5nZXMge1xuICBASW5wdXQoKVxuICBwdWJsaWMgbGVmdDogc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbiA9ICcnO1xuICBASW5wdXQoKVxuICBwdWJsaWMgcmlnaHQ6IHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4gPSAnJztcbiAgLy8gVGhlIG51bWJlciBvZiBsaW5lcyBvZiBjb250ZXh0IHRvIHByb3ZpZGUgZWl0aGVyIHNpZGUgb2YgYSBEaWZmT3AuSW5zZXJ0IG9yIERpZmZPcC5EZWxldGUgZGlmZi5cbiAgLy8gQ29udGV4dCBpcyB0YWtlbiBmcm9tIGEgRGlmZk9wLkVxdWFsIHNlY3Rpb24uXG4gIEBJbnB1dCgpXG4gIHB1YmxpYyBsaW5lQ29udGV4dFNpemU6IG51bWJlcjtcblxuICBwdWJsaWMgY2FsY3VsYXRlZERpZmY6IEFycmF5PFtzdHJpbmcsIHN0cmluZywgc3RyaW5nLCBzdHJpbmddPjtcbiAgcHVibGljIGlzQ29udGVudEVxdWFsOiBib29sZWFuO1xuXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgZG1wOiBEaWZmTWF0Y2hQYXRjaFNlcnZpY2UpIHt9XG5cbiAgcHVibGljIG5nT25Jbml0KCk6IHZvaWQge1xuICAgIHRoaXMudXBkYXRlSHRtbCgpO1xuICB9XG5cbiAgcHVibGljIG5nT25DaGFuZ2VzKCk6IHZvaWQge1xuICAgIHRoaXMudXBkYXRlSHRtbCgpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVIdG1sKCk6IHZvaWQge1xuICAgIGlmICh0eXBlb2YgdGhpcy5sZWZ0ID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgdGhpcy5sZWZ0ID09PSAnYm9vbGVhbicpIHtcbiAgICAgIHRoaXMubGVmdCA9IHRoaXMubGVmdC50b1N0cmluZygpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHRoaXMucmlnaHQgPT09ICdudW1iZXInIHx8IHR5cGVvZiB0aGlzLnJpZ2h0ID09PSAnYm9vbGVhbicpIHtcbiAgICAgIHRoaXMucmlnaHQgPSB0aGlzLnJpZ2h0LnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIHRoaXMuY2FsY3VsYXRlTGluZURpZmYodGhpcy5kbXAuZ2V0TGluZURpZmYodGhpcy5sZWZ0LCB0aGlzLnJpZ2h0KSk7XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZUxpbmVEaWZmKGRpZmZzOiBBcnJheTxEaWZmPik6IHZvaWQge1xuICAgIGNvbnN0IGRpZmZDYWxjdWxhdGlvbjogRGlmZkNhbGN1bGF0aW9uID0ge1xuICAgICAgbGluZXM6IFtdLFxuICAgICAgbGluZUxlZnQ6IDEsXG4gICAgICBsaW5lUmlnaHQ6IDFcbiAgICB9O1xuXG4gICAgdGhpcy5pc0NvbnRlbnRFcXVhbCA9IGRpZmZzLmxlbmd0aCA9PT0gMSAmJiBkaWZmc1swXVswXSA9PT0gRGlmZk9wLkVxdWFsO1xuICAgIGlmICh0aGlzLmlzQ29udGVudEVxdWFsKSB7XG4gICAgICB0aGlzLmNhbGN1bGF0ZWREaWZmID0gW107XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkaWZmcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZGlmZiA9IGRpZmZzW2ldO1xuICAgICAgbGV0IGRpZmZMaW5lczogc3RyaW5nW10gPSBkaWZmWzFdLnNwbGl0KC9cXHI/XFxuLyk7XG5cbiAgICAgIC8vIElmIHRoZSBvcmlnaW5hbCBsaW5lIGhhZCBhIFxcclxcbiBhdCB0aGUgZW5kIHRoZW4gcmVtb3ZlIHRoZVxuICAgICAgLy8gZW1wdHkgc3RyaW5nIGFmdGVyIGl0LlxuICAgICAgaWYgKGRpZmZMaW5lc1tkaWZmTGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoID09IDApIHtcbiAgICAgICAgZGlmZkxpbmVzLnBvcCgpO1xuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKGRpZmZbMF0pIHtcbiAgICAgICAgY2FzZSBEaWZmT3AuRXF1YWw6IHtcbiAgICAgICAgICBjb25zdCBpc0ZpcnN0RGlmZiA9IGkgPT09IDA7XG4gICAgICAgICAgY29uc3QgaXNMYXN0RGlmZiA9IGkgPT09IGRpZmZzLmxlbmd0aCAtIDE7XG4gICAgICAgICAgdGhpcy5vdXRwdXRFcXVhbERpZmYoZGlmZkxpbmVzLCBkaWZmQ2FsY3VsYXRpb24sIGlzRmlyc3REaWZmLCBpc0xhc3REaWZmKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIERpZmZPcC5EZWxldGU6IHtcbiAgICAgICAgICB0aGlzLm91dHB1dERlbGV0ZURpZmYoZGlmZkxpbmVzLCBkaWZmQ2FsY3VsYXRpb24pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgRGlmZk9wLkluc2VydDoge1xuICAgICAgICAgIHRoaXMub3V0cHV0SW5zZXJ0RGlmZihkaWZmTGluZXMsIGRpZmZDYWxjdWxhdGlvbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmNhbGN1bGF0ZWREaWZmID0gZGlmZkNhbGN1bGF0aW9uLmxpbmVzO1xuICB9XG5cbiAgLyogSWYgdGhlIG51bWJlciBvZiBkaWZmTGluZXMgaXMgZ3JlYXRlciB0aGFuIGxpbmVDb250ZXh0U2l6ZSB0aGVuIHdlIG1heSBuZWVkIHRvIGFkanVzdCB0aGUgZGlmZlxuICAgKiB0aGF0IGlzIG91dHB1dC5cbiAgICogICA+IElmIHRoZSBmaXJzdCBkaWZmIG9mIGEgZG9jdW1lbnQgaXMgRGlmZk9wLkVxdWFsIHRoZW4gdGhlIGxlYWRpbmcgbGluZXMgY2FuIGJlIGRyb3BwZWRcbiAgICogICAgIGxlYXZpbmcgdGhlIGxhc3QgJ2xpbmVDb250ZXh0U2l6ZScgbGluZXMgZm9yIGNvbnRleHQuXG4gICAqICAgPiBJZiB0aGUgbGFzdCBkaWZmIG9mIGEgZG9jdW1lbnQgaXMgRGlmZk9wLkVxdWFsIHRoZW4gdGhlIHRyYWlsaW5nIGxpbmVzIGNhbiBiZSBkcm9wcGVkXG4gICAqICAgICBsZWF2aW5nIHRoZSBmaXJzdCAnbGluZUNvbnRleHRTaXplJyBsaW5lcyBmb3IgY29udGV4dC5cbiAgICogICA+IElmIHRoZSBkaWZmIGlzIGEgRGlmZk9wLkVxdWFsIG9jY3VycyBpbiB0aGUgbWlkZGxlIHRoZW4gdGhlIGRpZmZzIGVpdGhlciBzaWRlIG9mIGl0IG11c3QgYmVcbiAgICogICAgIERpZmZPcC5JbnNlcnQgb3IgRGlmZk9wLkRlbGV0ZS4gSWYgaXQgaGFzIG1vcmUgdGhhbiAyICogJ2xpbmVDb250ZXh0U2l6ZScgbGluZXMgb2YgY29udGVudFxuICAgKiAgICAgdGhlbiB0aGUgbWlkZGxlIGxpbmVzIGFyZSBkcm9wcGVkIGxlYXZpbmcgdGhlIGZpcnN0ICdsaW5lQ29udGV4dFNpemUnIGFuZCBsYXN0ICdsaW5lQ29udGV4dFNpemUnXG4gICAqICAgICBsaW5lcyBmb3IgY29udGV4dC4gQSBzcGVjaWFsIGxpbmUgaXMgaW5zZXJ0ZWQgd2l0aCAnLi4uJyBpbmRpY2F0aW5nIHRoYXQgY29udGVudCBpcyBza2lwcGVkLlxuICAgKlxuICAgKiBBIGRvY3VtZW50IGNhbm5vdCBjb25zaXN0IG9mIGEgc2luZ2xlIERpZmYgd2l0aCBEaWZmT3AuRXF1YWwgYW5kIHJlYWNoIHRoaXMgZnVuY3Rpb24gYmVjYXVzZVxuICAgKiBpbiB0aGlzIGNhc2UgdGhlIGNhbGN1bGF0ZUxpbmVEaWZmIG1ldGhvZCByZXR1cm5zIGVhcmx5LlxuICAgKi9cbiAgcHJpdmF0ZSBvdXRwdXRFcXVhbERpZmYoXG4gICAgICBkaWZmTGluZXM6IHN0cmluZ1tdLFxuICAgICAgZGlmZkNhbGN1bGF0aW9uOiBEaWZmQ2FsY3VsYXRpb24sXG4gICAgICBpc0ZpcnN0RGlmZjogYm9vbGVhbixcbiAgICAgIGlzTGFzdERpZmY6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5saW5lQ29udGV4dFNpemUgJiYgZGlmZkxpbmVzLmxlbmd0aCA+IHRoaXMubGluZUNvbnRleHRTaXplKSB7XG4gICAgICBpZiAoaXNGaXJzdERpZmYpIHtcbiAgICAgICAgLy8gVGFrZSB0aGUgbGFzdCAnbGluZUNvbnRleHRTaXplJyBsaW5lcyBmcm9tIHRoZSBmaXJzdCBkaWZmXG4gICAgICAgIGNvbnN0IGxpbmVJbmNyZW1lbnQgPSBkaWZmTGluZXMubGVuZ3RoIC0gdGhpcy5saW5lQ29udGV4dFNpemU7XG4gICAgICAgIGRpZmZDYWxjdWxhdGlvbi5saW5lTGVmdCArPSBsaW5lSW5jcmVtZW50O1xuICAgICAgICBkaWZmQ2FsY3VsYXRpb24ubGluZVJpZ2h0ICs9IGxpbmVJbmNyZW1lbnQ7XG4gICAgICAgIGRpZmZMaW5lcyA9IGRpZmZMaW5lcy5zbGljZShkaWZmTGluZXMubGVuZ3RoIC0gdGhpcy5saW5lQ29udGV4dFNpemUsIGRpZmZMaW5lcy5sZW5ndGgpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoaXNMYXN0RGlmZikge1xuICAgICAgICAvLyBUYWtlIG9ubHkgdGhlIGZpcnN0ICdsaW5lQ29udGV4dFNpemUnIGxpbmVzIGZyb20gdGhlIGZpbmFsIGRpZmZcbiAgICAgICAgZGlmZkxpbmVzID0gZGlmZkxpbmVzLnNsaWNlKDAsIHRoaXMubGluZUNvbnRleHRTaXplKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGRpZmZMaW5lcy5sZW5ndGggPiAyICogdGhpcy5saW5lQ29udGV4dFNpemUpIHtcbiAgICAgICAgLy8gVGFrZSB0aGUgZmlyc3QgJ2xpbmVDb250ZXh0U2l6ZScgbGluZXMgZnJvbSB0aGlzIGRpZmYgdG8gcHJvdmlkZSBjb250ZXh0IGZvciB0aGUgbGFzdCBkaWZmXG4gICAgICAgIHRoaXMub3V0cHV0RXF1YWxEaWZmTGluZXMoZGlmZkxpbmVzLnNsaWNlKDAsIHRoaXMubGluZUNvbnRleHRTaXplKSwgZGlmZkNhbGN1bGF0aW9uKTtcblxuICAgICAgICAvLyBPdXRwdXQgYSBzcGVjaWFsIGxpbmUgaW5kaWNhdGluZyB0aGF0IHNvbWUgY29udGVudCBpcyBlcXVhbCBhbmQgaGFzIGJlZW4gc2tpcHBlZFxuICAgICAgICBkaWZmQ2FsY3VsYXRpb24ubGluZXMucHVzaChbJ2RtcC1saW5lLWNvbXBhcmUtZXF1YWwnLCAnLi4uJywgJy4uLicsICcuLi4nXSk7XG4gICAgICAgIGNvbnN0IG51bWJlck9mU2tpcHBlZExpbmVzID0gZGlmZkxpbmVzLmxlbmd0aCAtICgyICogdGhpcy5saW5lQ29udGV4dFNpemUpO1xuICAgICAgICBkaWZmQ2FsY3VsYXRpb24ubGluZUxlZnQgKz0gbnVtYmVyT2ZTa2lwcGVkTGluZXM7XG4gICAgICAgIGRpZmZDYWxjdWxhdGlvbi5saW5lUmlnaHQgKz0gbnVtYmVyT2ZTa2lwcGVkTGluZXM7XG5cbiAgICAgICAgLy8gVGFrZSB0aGUgbGFzdCAnbGluZUNvbnRleHRTaXplJyBsaW5lcyBmcm9tIHRoaXMgZGlmZiB0byBwcm92aWRlIGNvbnRleHQgZm9yIHRoZSBuZXh0IGRpZmZcbiAgICAgICAgdGhpcy5vdXRwdXRFcXVhbERpZmZMaW5lcyhkaWZmTGluZXMuc2xpY2UoZGlmZkxpbmVzLmxlbmd0aCAtIHRoaXMubGluZUNvbnRleHRTaXplKSwgZGlmZkNhbGN1bGF0aW9uKTtcbiAgICAgICAgLy8gVGhpcyBpZiBicmFuY2ggaGFzIGFscmVhZHkgb3V0cHV0IHRoZSBkaWZmIGxpbmVzIHNvIHdlIHJldHVybiBlYXJseSB0byBhdm9pZCBvdXRwdXR0aW5nIHRoZSBsaW5lc1xuICAgICAgICAvLyBhdCB0aGUgZW5kIG9mIHRoZSBtZXRob2QuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5vdXRwdXRFcXVhbERpZmZMaW5lcyhkaWZmTGluZXMsIGRpZmZDYWxjdWxhdGlvbik7XG4gIH1cblxuICBwcml2YXRlIG91dHB1dEVxdWFsRGlmZkxpbmVzKFxuICAgICAgZGlmZkxpbmVzOiBzdHJpbmdbXSxcbiAgICAgIGRpZmZDYWxjdWxhdGlvbjogRGlmZkNhbGN1bGF0aW9uKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGRpZmZMaW5lcykge1xuICAgICAgZGlmZkNhbGN1bGF0aW9uLmxpbmVzLnB1c2goWydkbXAtbGluZS1jb21wYXJlLWVxdWFsJywgYCR7ZGlmZkNhbGN1bGF0aW9uLmxpbmVMZWZ0fWAsIGAke2RpZmZDYWxjdWxhdGlvbi5saW5lUmlnaHR9YCwgbGluZV0pO1xuICAgICAgZGlmZkNhbGN1bGF0aW9uLmxpbmVMZWZ0Kys7XG4gICAgICBkaWZmQ2FsY3VsYXRpb24ubGluZVJpZ2h0Kys7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBvdXRwdXREZWxldGVEaWZmKFxuICAgICAgZGlmZkxpbmVzOiBzdHJpbmdbXSxcbiAgICAgIGRpZmZDYWxjdWxhdGlvbjogRGlmZkNhbGN1bGF0aW9uKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGRpZmZMaW5lcykge1xuICAgICAgZGlmZkNhbGN1bGF0aW9uLmxpbmVzLnB1c2goWydkbXAtbGluZS1jb21wYXJlLWRlbGV0ZScsIGAke2RpZmZDYWxjdWxhdGlvbi5saW5lTGVmdH1gLCAnLScsIGxpbmVdKTtcbiAgICAgIGRpZmZDYWxjdWxhdGlvbi5saW5lTGVmdCsrO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgb3V0cHV0SW5zZXJ0RGlmZihcbiAgICAgIGRpZmZMaW5lczogc3RyaW5nW10sXG4gICAgICBkaWZmQ2FsY3VsYXRpb246IERpZmZDYWxjdWxhdGlvbik6IHZvaWQge1xuICAgIGZvciAoY29uc3QgbGluZSBvZiBkaWZmTGluZXMpIHtcbiAgICAgIGRpZmZDYWxjdWxhdGlvbi5saW5lcy5wdXNoKFsnZG1wLWxpbmUtY29tcGFyZS1pbnNlcnQnLCAnLScsIGAke2RpZmZDYWxjdWxhdGlvbi5saW5lUmlnaHR9YCwgbGluZV0pO1xuICAgICAgZGlmZkNhbGN1bGF0aW9uLmxpbmVSaWdodCsrO1xuICAgIH1cbiAgfVxufVxuIl19