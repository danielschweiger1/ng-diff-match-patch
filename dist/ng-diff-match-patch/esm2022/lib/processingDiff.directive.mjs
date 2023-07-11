import { Directive, Input } from '@angular/core';
import * as i0 from "@angular/core";
import * as i1 from "./diffMatchPatch.service";
class ProcessingDiffDirective {
    constructor(el, dmp) {
        this.el = el;
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
        this.el.nativeElement.innerHTML = this.createHtml(this.dmp.getProcessingDiff(this.left, this.right));
    }
    // TODO: Need to fix this for line diffs
    createHtml(diffs) {
        let html;
        html = '<div>';
        for (let diff of diffs) {
            diff[1] = diff[1].replace(/\n/g, '<br/>');
            if (diff[0] === 0 /* DiffOp.Equal */) {
                html += '<span class="equal">' + diff[1] + '</span>';
            }
            if (diff[0] === -1 /* DiffOp.Delete */) {
                html += '<del>' + diff[1] + '</del>';
            }
            if (diff[0] === 1 /* DiffOp.Insert */) {
                html += '<ins>' + diff[1] + '</ins>';
            }
        }
        html += '</div>';
        return html;
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: ProcessingDiffDirective, deps: [{ token: i0.ElementRef }, { token: i1.DiffMatchPatchService }], target: i0.ɵɵFactoryTarget.Directive }); }
    static { this.ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "16.1.4", type: ProcessingDiffDirective, selector: "[processingDiff]", inputs: { left: "left", right: "right" }, usesOnChanges: true, ngImport: i0 }); }
}
export { ProcessingDiffDirective };
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: ProcessingDiffDirective, decorators: [{
            type: Directive,
            args: [{
                    selector: '[processingDiff]'
                }]
        }], ctorParameters: function () { return [{ type: i0.ElementRef }, { type: i1.DiffMatchPatchService }]; }, propDecorators: { left: [{
                type: Input
            }], right: [{
                type: Input
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzc2luZ0RpZmYuZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vcHJvamVjdHMvbmctZGlmZi1tYXRjaC1wYXRjaC9zcmMvbGliL3Byb2Nlc3NpbmdEaWZmLmRpcmVjdGl2ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFjLEtBQUssRUFBcUIsTUFBTSxlQUFlLENBQUM7OztBQUloRixNQUdhLHVCQUF1QjtJQUlsQyxZQUNVLEVBQWMsRUFDZCxHQUEwQjtRQUQxQixPQUFFLEdBQUYsRUFBRSxDQUFZO1FBQ2QsUUFBRyxHQUFILEdBQUcsQ0FBdUI7UUFMM0IsU0FBSSxHQUFXLEVBQUUsQ0FBQztRQUNsQixVQUFLLEdBQVcsRUFBRSxDQUFDO0lBSWEsQ0FBQztJQUVuQyxRQUFRO1FBQ2IsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3BCLENBQUM7SUFFTSxXQUFXO1FBQ2hCLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUNwQixDQUFDO0lBRU8sVUFBVTtRQUNoQixJQUFJLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FDL0MsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7SUFFRCx3Q0FBd0M7SUFDaEMsVUFBVSxDQUFDLEtBQWtCO1FBQ25DLElBQUksSUFBWSxDQUFDO1FBQ2pCLElBQUksR0FBRyxPQUFPLENBQUM7UUFDZixLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRTtZQUN0QixJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFFMUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLHlCQUFpQixFQUFFO2dCQUM1QixJQUFJLElBQUksc0JBQXNCLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQzthQUN0RDtZQUNELElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQywyQkFBa0IsRUFBRTtnQkFDN0IsSUFBSSxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDO2FBQ3RDO1lBQ0QsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLDBCQUFrQixFQUFFO2dCQUM3QixJQUFJLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUM7YUFDdEM7U0FDRjtRQUNELElBQUksSUFBSSxRQUFRLENBQUM7UUFDakIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDOzhHQXhDVSx1QkFBdUI7a0dBQXZCLHVCQUF1Qjs7U0FBdkIsdUJBQXVCOzJGQUF2Qix1QkFBdUI7a0JBSG5DLFNBQVM7bUJBQUM7b0JBQ1QsUUFBUSxFQUFFLGtCQUFrQjtpQkFDN0I7cUlBRVUsSUFBSTtzQkFBWixLQUFLO2dCQUNHLEtBQUs7c0JBQWIsS0FBSyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERpcmVjdGl2ZSwgRWxlbWVudFJlZiwgSW5wdXQsIE9uSW5pdCwgT25DaGFuZ2VzIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBEaWZmTWF0Y2hQYXRjaFNlcnZpY2UgfSBmcm9tICcuL2RpZmZNYXRjaFBhdGNoLnNlcnZpY2UnO1xuaW1wb3J0IHsgRGlmZiwgRGlmZk9wIH0gZnJvbSAnLi9kaWZmTWF0Y2hQYXRjaCc7XG5cbkBEaXJlY3RpdmUoe1xuICBzZWxlY3RvcjogJ1twcm9jZXNzaW5nRGlmZl0nXG59KVxuZXhwb3J0IGNsYXNzIFByb2Nlc3NpbmdEaWZmRGlyZWN0aXZlIGltcGxlbWVudHMgT25Jbml0LCBPbkNoYW5nZXMge1xuICBASW5wdXQoKSBsZWZ0OiBzdHJpbmcgPSAnJztcbiAgQElucHV0KCkgcmlnaHQ6IHN0cmluZyA9ICcnO1xuXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGVsOiBFbGVtZW50UmVmLFxuICAgIHByaXZhdGUgZG1wOiBEaWZmTWF0Y2hQYXRjaFNlcnZpY2UpIHsgIH1cblxuICBwdWJsaWMgbmdPbkluaXQoKTogdm9pZCB7XG4gICAgdGhpcy51cGRhdGVIdG1sKCk7XG4gIH1cblxuICBwdWJsaWMgbmdPbkNoYW5nZXMoKTogdm9pZCB7XG4gICAgdGhpcy51cGRhdGVIdG1sKCk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUh0bWwoKTogdm9pZCB7XG4gICAgdGhpcy5lbC5uYXRpdmVFbGVtZW50LmlubmVySFRNTCA9IHRoaXMuY3JlYXRlSHRtbChcbiAgICAgIHRoaXMuZG1wLmdldFByb2Nlc3NpbmdEaWZmKHRoaXMubGVmdCwgdGhpcy5yaWdodCkpO1xuICB9XG5cbiAgLy8gVE9ETzogTmVlZCB0byBmaXggdGhpcyBmb3IgbGluZSBkaWZmc1xuICBwcml2YXRlIGNyZWF0ZUh0bWwoZGlmZnM6IEFycmF5PERpZmY+KTogc3RyaW5nIHtcbiAgICBsZXQgaHRtbDogc3RyaW5nO1xuICAgIGh0bWwgPSAnPGRpdj4nO1xuICAgIGZvciAobGV0IGRpZmYgb2YgZGlmZnMpIHtcbiAgICAgIGRpZmZbMV0gPSBkaWZmWzFdLnJlcGxhY2UoL1xcbi9nLCAnPGJyLz4nKTtcblxuICAgICAgaWYgKGRpZmZbMF0gPT09IERpZmZPcC5FcXVhbCkge1xuICAgICAgICBodG1sICs9ICc8c3BhbiBjbGFzcz1cImVxdWFsXCI+JyArIGRpZmZbMV0gKyAnPC9zcGFuPic7XG4gICAgICB9XG4gICAgICBpZiAoZGlmZlswXSA9PT0gRGlmZk9wLkRlbGV0ZSkge1xuICAgICAgICBodG1sICs9ICc8ZGVsPicgKyBkaWZmWzFdICsgJzwvZGVsPic7XG4gICAgICB9XG4gICAgICBpZiAoZGlmZlswXSA9PT0gRGlmZk9wLkluc2VydCkge1xuICAgICAgICBodG1sICs9ICc8aW5zPicgKyBkaWZmWzFdICsgJzwvaW5zPic7XG4gICAgICB9XG4gICAgfVxuICAgIGh0bWwgKz0gJzwvZGl2Pic7XG4gICAgcmV0dXJuIGh0bWw7XG4gIH1cbn1cbiJdfQ==