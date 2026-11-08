#include "UEMock.h"
#include <cstdio>
#include <fstream>
#include <sstream>
#include <sys/stat.h>

bool FFileHelper::SaveStringToFile(const FString& S, const char* Path, EEncodingOptions)
{
	std::string Dir(Path); Dir = Dir.substr(0, Dir.find_last_of('/'));
	std::string Cmd = "mkdir -p '" + Dir + "'"; if (std::system(Cmd.c_str()) != 0) return false;
	std::ofstream F(Path, std::ios::binary); F << S.S; return (bool)F;
}
bool FFileHelper::LoadFileToString(FString& Out, const char* Path)
{
	std::ifstream F(Path, std::ios::binary); if (!F) return false;
	std::stringstream B; B << F.rdbuf(); Out = FString(B.str()); return true;
}
bool IFileManager::FileExists(const char* Path) { struct stat St; return stat(Path, &St) == 0; }
bool IFileManager::Delete(const char* Path) { return std::remove(Path) == 0; }
bool IFileManager::Move(const char* Dest, const char* Src, bool) { std::remove(Dest); return std::rename(Src, Dest) == 0; }
