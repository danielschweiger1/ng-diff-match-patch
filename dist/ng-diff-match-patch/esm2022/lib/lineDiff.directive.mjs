import { Directive, Input } from '@angular/core';
import * as i0 from "@angular/core";
import * as i1 from "./diffMatchPatch.service";
class LineDiffDirective {
    constructor(el, dmp) {
        this.el = el;
        this.dmp = dmp;
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
        this.el.nativeElement.innerHTML = this.createHtml(this.dmp.getLineDiff(this.left, this.right));
    }
    // TODO: Need to fix this for line diffs
    createHtml(diffs) {
        let html;
        html = '<div>';
        for (let diff of diffs) {
            if (diff[0] === 0 /* DiffOp.Equal */) {
                html += '<span class="equal">' + diff[1] + '</span>';
            }
            if (diff[0] === -1 /* DiffOp.Delete */) {
                html += '<div class=\"del\"> - <del>' + diff[1] + '</del></div>\n';
            }
            if (diff[0] === 1 /* DiffOp.Insert */) {
                html += '<div class=\"ins\"> + <ins>' + diff[1] + '</ins></div>\n';
            }
        }
        html += '</div>';
        return html;
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: LineDiffDirective, deps: [{ token: i0.ElementRef }, { token: i1.DiffMatchPatchService }], target: i0.ɵɵFactoryTarget.Directive }); }
    static { this.ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "16.1.4", type: LineDiffDirective, selector: "[lineDiff]", inputs: { left: "left", right: "right" }, usesOnChanges: true, ngImport: i0 }); }
}
export { LineDiffDirective };
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: LineDiffDirective, decorators: [{
            type: Directive,
            args: [{
                    selector: '[lineDiff]',
                }]
        }], ctorParameters: function () { return [{ type: i0.ElementRef }, { type: i1.DiffMatchPatchService }]; }, propDecorators: { left: [{
                type: Input
            }], right: [{
                type: Input
            }] } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluZURpZmYuZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vcHJvamVjdHMvbmctZGlmZi1tYXRjaC1wYXRjaC9zcmMvbGliL2xpbmVEaWZmLmRpcmVjdGl2ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFjLEtBQUssRUFBcUIsTUFBTSxlQUFlLENBQUM7OztBQUloRixNQUdhLGlCQUFpQjtJQUk1QixZQUNVLEVBQWMsRUFDZCxHQUEwQjtRQUQxQixPQUFFLEdBQUYsRUFBRSxDQUFZO1FBQ2QsUUFBRyxHQUFILEdBQUcsQ0FBdUI7SUFBSyxDQUFDO0lBRW5DLFFBQVE7UUFDYixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDcEIsQ0FBQztJQUVNLFdBQVc7UUFDaEIsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3BCLENBQUM7SUFFTyxVQUFVO1FBQ2hCLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO1lBQ25FLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUNsQztRQUNELElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxLQUFLLFFBQVEsSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFFO1lBQ3JFLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUNwQztRQUNELElBQUksQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDakcsQ0FBQztJQUVELHdDQUF3QztJQUNoQyxVQUFVLENBQUMsS0FBa0I7UUFDbkMsSUFBSSxJQUFZLENBQUM7UUFDakIsSUFBSSxHQUFHLE9BQU8sQ0FBQztRQUNmLEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3RCLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyx5QkFBaUIsRUFBRTtnQkFDNUIsSUFBSSxJQUFJLHNCQUFzQixHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUM7YUFDdEQ7WUFDRCxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsMkJBQWtCLEVBQUU7Z0JBQzdCLElBQUksSUFBSSw2QkFBNkIsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsZ0JBQWdCLENBQUM7YUFDcEU7WUFDRCxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsMEJBQWtCLEVBQUU7Z0JBQzdCLElBQUksSUFBSSw2QkFBNkIsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsZ0JBQWdCLENBQUM7YUFDcEU7U0FDRjtRQUNELElBQUksSUFBSSxRQUFRLENBQUM7UUFDakIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDOzhHQTNDVSxpQkFBaUI7a0dBQWpCLGlCQUFpQjs7U0FBakIsaUJBQWlCOzJGQUFqQixpQkFBaUI7a0JBSDdCLFNBQVM7bUJBQUM7b0JBQ1QsUUFBUSxFQUFFLFlBQVk7aUJBQ3ZCO3FJQUVVLElBQUk7c0JBQVosS0FBSztnQkFDRyxLQUFLO3NCQUFiLEtBQUsiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEaXJlY3RpdmUsIEVsZW1lbnRSZWYsIElucHV0LCBPbkluaXQsIE9uQ2hhbmdlcyB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgRGlmZk1hdGNoUGF0Y2hTZXJ2aWNlIH0gZnJvbSAnLi9kaWZmTWF0Y2hQYXRjaC5zZXJ2aWNlJztcbmltcG9ydCB7IERpZmYsIERpZmZPcCB9IGZyb20gJy4vZGlmZk1hdGNoUGF0Y2gnO1xuXG5ARGlyZWN0aXZlKHtcbiAgc2VsZWN0b3I6ICdbbGluZURpZmZdJyxcbn0pXG5leHBvcnQgY2xhc3MgTGluZURpZmZEaXJlY3RpdmUgaW1wbGVtZW50cyBPbkluaXQsIE9uQ2hhbmdlcyB7XG4gIEBJbnB1dCgpIGxlZnQ6IHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW47XG4gIEBJbnB1dCgpIHJpZ2h0OiBzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuO1xuXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGVsOiBFbGVtZW50UmVmLFxuICAgIHByaXZhdGUgZG1wOiBEaWZmTWF0Y2hQYXRjaFNlcnZpY2UpIHsgIH1cblxuICBwdWJsaWMgbmdPbkluaXQoKTogdm9pZCB7XG4gICAgdGhpcy51cGRhdGVIdG1sKCk7XG4gIH1cblxuICBwdWJsaWMgbmdPbkNoYW5nZXMoKTogdm9pZCB7XG4gICAgdGhpcy51cGRhdGVIdG1sKCk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUh0bWwoKTogdm9pZCB7XG4gICAgaWYgKHR5cGVvZiB0aGlzLmxlZnQgPT09ICdudW1iZXInIHx8IHR5cGVvZiB0aGlzLmxlZnQgPT09ICdib29sZWFuJykge1xuICAgICAgdGhpcy5sZWZ0ID0gdGhpcy5sZWZ0LnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgdGhpcy5yaWdodCA9PT0gJ251bWJlcicgfHwgdHlwZW9mIHRoaXMucmlnaHQgPT09ICdib29sZWFuJykge1xuICAgICAgdGhpcy5yaWdodCA9IHRoaXMucmlnaHQudG9TdHJpbmcoKTtcbiAgICB9XG4gICAgdGhpcy5lbC5uYXRpdmVFbGVtZW50LmlubmVySFRNTCA9IHRoaXMuY3JlYXRlSHRtbCh0aGlzLmRtcC5nZXRMaW5lRGlmZih0aGlzLmxlZnQsIHRoaXMucmlnaHQpKTtcbiAgfVxuXG4gIC8vIFRPRE86IE5lZWQgdG8gZml4IHRoaXMgZm9yIGxpbmUgZGlmZnNcbiAgcHJpdmF0ZSBjcmVhdGVIdG1sKGRpZmZzOiBBcnJheTxEaWZmPik6IHN0cmluZyB7XG4gICAgbGV0IGh0bWw6IHN0cmluZztcbiAgICBodG1sID0gJzxkaXY+JztcbiAgICBmb3IgKGxldCBkaWZmIG9mIGRpZmZzKSB7XG4gICAgICBpZiAoZGlmZlswXSA9PT0gRGlmZk9wLkVxdWFsKSB7XG4gICAgICAgIGh0bWwgKz0gJzxzcGFuIGNsYXNzPVwiZXF1YWxcIj4nICsgZGlmZlsxXSArICc8L3NwYW4+JztcbiAgICAgIH1cbiAgICAgIGlmIChkaWZmWzBdID09PSBEaWZmT3AuRGVsZXRlKSB7XG4gICAgICAgIGh0bWwgKz0gJzxkaXYgY2xhc3M9XFxcImRlbFxcXCI+IC0gPGRlbD4nICsgZGlmZlsxXSArICc8L2RlbD48L2Rpdj5cXG4nO1xuICAgICAgfVxuICAgICAgaWYgKGRpZmZbMF0gPT09IERpZmZPcC5JbnNlcnQpIHtcbiAgICAgICAgaHRtbCArPSAnPGRpdiBjbGFzcz1cXFwiaW5zXFxcIj4gKyA8aW5zPicgKyBkaWZmWzFdICsgJzwvaW5zPjwvZGl2Plxcbic7XG4gICAgICB9XG4gICAgfVxuICAgIGh0bWwgKz0gJzwvZGl2Pic7XG4gICAgcmV0dXJuIGh0bWw7XG4gIH1cbn1cbiJdfQ==