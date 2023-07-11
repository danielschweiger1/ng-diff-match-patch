import { Injectable } from '@angular/core';
import * as i0 from "@angular/core";
import * as i1 from "./diffMatchPatch";
class DiffMatchPatchService {
    constructor(dmp) {
        this.dmp = dmp;
    }
    ngOnInit() {
    }
    getDiff(left, right) {
        return this.dmp.diff_main(left, right);
    }
    getSemanticDiff(left, right) {
        const diffs = this.dmp.diff_main(left, right);
        this.dmp.diff_cleanupSemantic(diffs);
        return diffs;
    }
    getProcessingDiff(left, right) {
        const diffs = this.dmp.diff_main(left, right);
        this.dmp.diff_cleanupEfficiency(diffs);
        return diffs;
    }
    getLineDiff(left, right) {
        const chars = this.dmp.diff_linesToChars_(left, right);
        const diffs = this.dmp.diff_main(chars.chars1, chars.chars2, false);
        this.dmp.diff_charsToLines_(diffs, chars.lineArray);
        return diffs;
    }
    getDmp() {
        return this.dmp;
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: DiffMatchPatchService, deps: [{ token: i1.DiffMatchPatch }], target: i0.ɵɵFactoryTarget.Injectable }); }
    static { this.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: DiffMatchPatchService }); }
}
export { DiffMatchPatchService };
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: DiffMatchPatchService, decorators: [{
            type: Injectable
        }], ctorParameters: function () { return [{ type: i1.DiffMatchPatch }]; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZk1hdGNoUGF0Y2guc2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Byb2plY3RzL25nLWRpZmYtbWF0Y2gtcGF0Y2gvc3JjL2xpYi9kaWZmTWF0Y2hQYXRjaC5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxVQUFVLEVBQVUsTUFBTSxlQUFlLENBQUM7OztBQUduRCxNQUNhLHFCQUFxQjtJQUVoQyxZQUFvQixHQUFtQjtRQUFuQixRQUFHLEdBQUgsR0FBRyxDQUFnQjtJQUFNLENBQUM7SUFFOUMsUUFBUTtJQUVSLENBQUM7SUFFRCxPQUFPLENBQUMsSUFBWSxFQUFFLEtBQWE7UUFDaEMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVELGVBQWUsQ0FBQyxJQUFZLEVBQUUsS0FBYTtRQUN6QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDOUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyQyxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxJQUFZLEVBQUUsS0FBYTtRQUMzQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDOUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2QyxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFRCxXQUFXLENBQUMsSUFBWSxFQUFFLEtBQWE7UUFDckMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDdkQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwRCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFRCxNQUFNO1FBQ0osT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ2xCLENBQUM7OEdBakNVLHFCQUFxQjtrSEFBckIscUJBQXFCOztTQUFyQixxQkFBcUI7MkZBQXJCLHFCQUFxQjtrQkFEakMsVUFBVSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdGFibGUsIE9uSW5pdCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgRGlmZk1hdGNoUGF0Y2gsIERpZmZPcCB9IGZyb20gJy4vZGlmZk1hdGNoUGF0Y2gnO1xuXG5ASW5qZWN0YWJsZSgpXG5leHBvcnQgY2xhc3MgRGlmZk1hdGNoUGF0Y2hTZXJ2aWNlIGltcGxlbWVudHMgT25Jbml0IHtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGRtcDogRGlmZk1hdGNoUGF0Y2gpIHsgICB9XG5cbiAgbmdPbkluaXQgKCkge1xuXG4gIH1cblxuICBnZXREaWZmKGxlZnQ6IHN0cmluZywgcmlnaHQ6IHN0cmluZykge1xuICAgICByZXR1cm4gdGhpcy5kbXAuZGlmZl9tYWluKGxlZnQsIHJpZ2h0KTtcbiAgfVxuXG4gIGdldFNlbWFudGljRGlmZihsZWZ0OiBzdHJpbmcsIHJpZ2h0OiBzdHJpbmcpIHtcbiAgICBjb25zdCBkaWZmcyA9IHRoaXMuZG1wLmRpZmZfbWFpbihsZWZ0LCByaWdodCk7XG4gICAgdGhpcy5kbXAuZGlmZl9jbGVhbnVwU2VtYW50aWMoZGlmZnMpO1xuICAgIHJldHVybiBkaWZmcztcbiAgfVxuXG4gIGdldFByb2Nlc3NpbmdEaWZmKGxlZnQ6IHN0cmluZywgcmlnaHQ6IHN0cmluZykge1xuICAgIGNvbnN0IGRpZmZzID0gdGhpcy5kbXAuZGlmZl9tYWluKGxlZnQsIHJpZ2h0KTtcbiAgICB0aGlzLmRtcC5kaWZmX2NsZWFudXBFZmZpY2llbmN5KGRpZmZzKTtcbiAgICByZXR1cm4gZGlmZnM7XG4gIH1cblxuICBnZXRMaW5lRGlmZihsZWZ0OiBzdHJpbmcsIHJpZ2h0OiBzdHJpbmcpIHtcbiAgICBjb25zdCBjaGFycyA9IHRoaXMuZG1wLmRpZmZfbGluZXNUb0NoYXJzXyhsZWZ0LCByaWdodCk7XG4gICAgY29uc3QgZGlmZnMgPSB0aGlzLmRtcC5kaWZmX21haW4oY2hhcnMuY2hhcnMxLCBjaGFycy5jaGFyczIsIGZhbHNlKTtcbiAgICB0aGlzLmRtcC5kaWZmX2NoYXJzVG9MaW5lc18oZGlmZnMsIGNoYXJzLmxpbmVBcnJheSk7XG4gICAgcmV0dXJuIGRpZmZzO1xuICB9XG5cbiAgZ2V0RG1wKCkge1xuICAgIHJldHVybiB0aGlzLmRtcDtcbiAgfVxuXG59XG4iXX0=