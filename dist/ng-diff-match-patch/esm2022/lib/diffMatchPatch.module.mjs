import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiffDirective } from './diff.directive';
import { LineDiffDirective } from './lineDiff.directive';
import { ProcessingDiffDirective } from './processingDiff.directive';
import { SemanticDiffDirective } from './semanticDiff.directive';
import { LineCompareComponent } from './lineCompare.component';
import { DiffMatchPatch } from './diffMatchPatch';
import { DiffMatchPatchService } from './diffMatchPatch.service';
import * as i0 from "@angular/core";
class DiffMatchPatchModule {
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: DiffMatchPatchModule, deps: [], target: i0.ɵɵFactoryTarget.NgModule }); }
    static { this.ɵmod = i0.ɵɵngDeclareNgModule({ minVersion: "14.0.0", version: "16.1.4", ngImport: i0, type: DiffMatchPatchModule, declarations: [DiffDirective,
            LineDiffDirective,
            ProcessingDiffDirective,
            SemanticDiffDirective,
            LineCompareComponent], imports: [CommonModule], exports: [DiffDirective,
            LineDiffDirective,
            ProcessingDiffDirective,
            SemanticDiffDirective,
            LineCompareComponent] }); }
    static { this.ɵinj = i0.ɵɵngDeclareInjector({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: DiffMatchPatchModule, providers: [
            DiffMatchPatch,
            DiffMatchPatchService
        ], imports: [CommonModule] }); }
}
export { DiffMatchPatchModule };
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "16.1.4", ngImport: i0, type: DiffMatchPatchModule, decorators: [{
            type: NgModule,
            args: [{
                    declarations: [
                        DiffDirective,
                        LineDiffDirective,
                        ProcessingDiffDirective,
                        SemanticDiffDirective,
                        LineCompareComponent
                    ],
                    imports: [
                        CommonModule
                    ],
                    exports: [
                        DiffDirective,
                        LineDiffDirective,
                        ProcessingDiffDirective,
                        SemanticDiffDirective,
                        LineCompareComponent
                    ],
                    providers: [
                        DiffMatchPatch,
                        DiffMatchPatchService
                    ]
                }]
        }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZk1hdGNoUGF0Y2gubW9kdWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vcHJvamVjdHMvbmctZGlmZi1tYXRjaC1wYXRjaC9zcmMvbGliL2RpZmZNYXRjaFBhdGNoLm1vZHVsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3pDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDakQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDekQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDckUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDakUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFFL0QsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ2xELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDBCQUEwQixDQUFDOztBQUVqRSxNQXVCYSxvQkFBb0I7OEdBQXBCLG9CQUFvQjsrR0FBcEIsb0JBQW9CLGlCQXJCN0IsYUFBYTtZQUNiLGlCQUFpQjtZQUNqQix1QkFBdUI7WUFDdkIscUJBQXFCO1lBQ3JCLG9CQUFvQixhQUdwQixZQUFZLGFBR1osYUFBYTtZQUNiLGlCQUFpQjtZQUNqQix1QkFBdUI7WUFDdkIscUJBQXFCO1lBQ3JCLG9CQUFvQjsrR0FPWCxvQkFBb0IsYUFMcEI7WUFDVCxjQUFjO1lBQ2QscUJBQXFCO1NBQ3RCLFlBWkMsWUFBWTs7U0FjSCxvQkFBb0I7MkZBQXBCLG9CQUFvQjtrQkF2QmhDLFFBQVE7bUJBQUM7b0JBQ1IsWUFBWSxFQUFFO3dCQUNaLGFBQWE7d0JBQ2IsaUJBQWlCO3dCQUNqQix1QkFBdUI7d0JBQ3ZCLHFCQUFxQjt3QkFDckIsb0JBQW9CO3FCQUNyQjtvQkFDRCxPQUFPLEVBQUU7d0JBQ1AsWUFBWTtxQkFDYjtvQkFDRCxPQUFPLEVBQUU7d0JBQ1AsYUFBYTt3QkFDYixpQkFBaUI7d0JBQ2pCLHVCQUF1Qjt3QkFDdkIscUJBQXFCO3dCQUNyQixvQkFBb0I7cUJBQ3JCO29CQUNELFNBQVMsRUFBRTt3QkFDVCxjQUFjO3dCQUNkLHFCQUFxQjtxQkFDdEI7aUJBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOZ01vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IERpZmZEaXJlY3RpdmUgfSBmcm9tICcuL2RpZmYuZGlyZWN0aXZlJztcbmltcG9ydCB7IExpbmVEaWZmRGlyZWN0aXZlIH0gZnJvbSAnLi9saW5lRGlmZi5kaXJlY3RpdmUnO1xuaW1wb3J0IHsgUHJvY2Vzc2luZ0RpZmZEaXJlY3RpdmUgfSBmcm9tICcuL3Byb2Nlc3NpbmdEaWZmLmRpcmVjdGl2ZSc7XG5pbXBvcnQgeyBTZW1hbnRpY0RpZmZEaXJlY3RpdmUgfSBmcm9tICcuL3NlbWFudGljRGlmZi5kaXJlY3RpdmUnO1xuaW1wb3J0IHsgTGluZUNvbXBhcmVDb21wb25lbnQgfSBmcm9tICcuL2xpbmVDb21wYXJlLmNvbXBvbmVudCc7XG5cbmltcG9ydCB7IERpZmZNYXRjaFBhdGNoIH0gZnJvbSAnLi9kaWZmTWF0Y2hQYXRjaCc7XG5pbXBvcnQgeyBEaWZmTWF0Y2hQYXRjaFNlcnZpY2UgfSBmcm9tICcuL2RpZmZNYXRjaFBhdGNoLnNlcnZpY2UnO1xuXG5ATmdNb2R1bGUoe1xuICBkZWNsYXJhdGlvbnM6IFtcbiAgICBEaWZmRGlyZWN0aXZlLFxuICAgIExpbmVEaWZmRGlyZWN0aXZlLFxuICAgIFByb2Nlc3NpbmdEaWZmRGlyZWN0aXZlLFxuICAgIFNlbWFudGljRGlmZkRpcmVjdGl2ZSxcbiAgICBMaW5lQ29tcGFyZUNvbXBvbmVudFxuICBdLFxuICBpbXBvcnRzOiBbXG4gICAgQ29tbW9uTW9kdWxlXG4gIF0sXG4gIGV4cG9ydHM6IFtcbiAgICBEaWZmRGlyZWN0aXZlLFxuICAgIExpbmVEaWZmRGlyZWN0aXZlLFxuICAgIFByb2Nlc3NpbmdEaWZmRGlyZWN0aXZlLFxuICAgIFNlbWFudGljRGlmZkRpcmVjdGl2ZSxcbiAgICBMaW5lQ29tcGFyZUNvbXBvbmVudFxuICBdLFxuICBwcm92aWRlcnM6IFtcbiAgICBEaWZmTWF0Y2hQYXRjaCxcbiAgICBEaWZmTWF0Y2hQYXRjaFNlcnZpY2VcbiAgXVxufSlcbmV4cG9ydCBjbGFzcyBEaWZmTWF0Y2hQYXRjaE1vZHVsZSB7IH1cbiJdfQ==