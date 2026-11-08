using UnrealBuildTool;

public class AnstossFM13 : ModuleRules
{
	public AnstossFM13(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore" });
		// Game/ bindet den Kern als "FM13Core/..." ein
		PublicIncludePaths.Add(ModuleDirectory);
	}
}
